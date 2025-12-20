import * as fs from 'fs';
import * as path from 'path';
import {
  validateManifest,
  validateVisualizationOutput,
  validateConfig,
  validateManifestStructure,
  ValidationError
} from '../../src/utils/visualization-validator';
import { VisualizationOutput, VisualizationConfig } from '../../src/types';
import { ParsedData } from '../../src/utils/file-parser';

describe('visualization-validator', () => {
  const testDataDir = path.join(__dirname, '../../test-workspace/viz-validator-test');
  
  beforeAll(async () => {
    // Create test directory
    await fs.promises.mkdir(testDataDir, { recursive: true });
  });
  
  afterAll(async () => {
    // Clean up test directory
    await fs.promises.rm(testDataDir, { recursive: true, force: true });
  });
  
  describe('validateManifestStructure', () => {
    it('should validate valid manifest structure', () => {
      const manifest = {
        version: '1.0',
        outputs: [
          {
            id: 'chart1',
            type: 'bar_chart',
            title: 'Test Chart'
          }
        ]
      };
      
      const result = validateManifestStructure(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject null manifest', () => {
      const result = validateManifestStructure(null);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('manifest');
    });
    
    it('should reject manifest without version', () => {
      const manifest = {
        outputs: []
      };
      
      const result = validateManifestStructure(manifest);
      
      expect(result.valid).toBe(false);
      const versionError = result.errors.find(e => e.field === 'version');
      expect(versionError).toBeDefined();
    });
    
    it('should reject manifest without outputs array', () => {
      const manifest = {
        version: '1.0'
      };
      
      const result = validateManifestStructure(manifest);
      
      expect(result.valid).toBe(false);
      const outputsError = result.errors.find(e => e.field === 'outputs');
      expect(outputsError).toBeDefined();
    });
    
    it('should warn about empty outputs', () => {
      const manifest = {
        version: '1.0',
        outputs: []
      };
      
      const result = validateManifestStructure(manifest);
      
      expect(result.valid).toBe(true); // Warnings don't invalidate
      const warning = result.errors.find(e => e.severity === 'warning');
      expect(warning).toBeDefined();
    });
    
    it('should reject output without id', () => {
      const manifest = {
        version: '1.0',
        outputs: [
          {
            type: 'table'
          }
        ]
      };
      
      const result = validateManifestStructure(manifest);
      
      expect(result.valid).toBe(false);
      const idError = result.errors.find(e => e.field.includes('.id'));
      expect(idError).toBeDefined();
    });
    
    it('should reject output with invalid type', () => {
      const manifest = {
        version: '1.0',
        outputs: [
          {
            id: 'test',
            type: 'invalid_type'
          }
        ]
      };
      
      const result = validateManifestStructure(manifest);
      
      expect(result.valid).toBe(false);
      const typeError = result.errors.find(e => e.field.includes('.type'));
      expect(typeError).toBeDefined();
      expect(typeError!.message).toContain('invalid_type');
    });
  });
  
  describe('validateManifest', () => {
    it('should validate valid manifest file', async () => {
      const manifestPath = path.join(testDataDir, 'valid-manifest.json');
      const dataPath = path.join(testDataDir, 'data.csv');
      
      // Create data file
      await fs.promises.writeFile(dataPath, 'name,value\nA,10\nB,20');
      
      // Create manifest
      const manifest = {
        version: '1.0',
        outputs: [
          {
            id: 'chart1',
            type: 'bar_chart',
            title: 'Test Chart',
            dataFile: 'data.csv'
          }
        ]
      };
      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      
      const result = await validateManifest(manifestPath, testDataDir);
      
      expect(result.valid).toBe(true);
      expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });
    
    it('should handle non-existent manifest file', async () => {
      const manifestPath = path.join(testDataDir, 'non-existent.json');
      
      const result = await validateManifest(manifestPath, testDataDir);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('not found');
    });
    
    it('should handle invalid JSON in manifest', async () => {
      const manifestPath = path.join(testDataDir, 'invalid-json.json');
      await fs.promises.writeFile(manifestPath, '{ invalid json }');
      
      const result = await validateManifest(manifestPath, testDataDir);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid JSON');
    });
    
    it('should detect missing data file', async () => {
      const manifestPath = path.join(testDataDir, 'missing-data.json');
      const manifest = {
        version: '1.0',
        outputs: [
          {
            id: 'chart1',
            type: 'table',
            dataFile: 'missing.csv'
          }
        ]
      };
      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest));
      
      const result = await validateManifest(manifestPath, testDataDir);
      
      expect(result.valid).toBe(false);
      const dataFileError = result.errors.find(e => e.field.includes('dataFile'));
      expect(dataFileError).toBeDefined();
      expect(dataFileError!.message).toContain('not found');
    });
  });
  
  describe('validateVisualizationOutput', () => {
    const mockData: ParsedData = {
      rows: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 }
      ],
      columns: ['name', 'value'],
      rowCount: 2
    };
    
    it('should validate valid output', () => {
      const output: VisualizationOutput = {
        id: 'chart1',
        type: 'table',
        title: 'Test Table',
        data: mockData.rows
      };
      
      const errors = validateVisualizationOutput(output, mockData);
      
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });
    
    it('should reject output without id', () => {
      const output: any = {
        type: 'table',
        data: mockData.rows
      };
      
      const errors = validateVisualizationOutput(output, mockData);
      
      const idError = errors.find(e => e.field === 'id');
      expect(idError).toBeDefined();
    });
    
    it('should reject output without type', () => {
      const output: any = {
        id: 'chart1',
        data: mockData.rows
      };
      
      const errors = validateVisualizationOutput(output, mockData);
      
      const typeError = errors.find(e => e.field === 'type');
      expect(typeError).toBeDefined();
    });
    
    it('should reject output without data', () => {
      const output: any = {
        id: 'chart1',
        type: 'table'
      };
      
      const errors = validateVisualizationOutput(output, mockData);
      
      const dataError = errors.find(e => e.field === 'data');
      expect(dataError).toBeDefined();
    });
    
    it('should warn about empty data', () => {
      const output: VisualizationOutput = {
        id: 'chart1',
        type: 'table',
        data: []
      };
      
      const emptyData: ParsedData = { rows: [], columns: [], rowCount: 0 };
      const errors = validateVisualizationOutput(output, emptyData);
      
      const warning = errors.find(e => e.severity === 'warning');
      expect(warning).toBeDefined();
    });
  });
  
  describe('validateConfig', () => {
    const columns = ['month', 'revenue', 'expenses', 'category'];
    
    describe('table config', () => {
      it('should validate valid table columns', () => {
        const config: VisualizationConfig = {
          columns: ['month', 'revenue']
        };
        
        const errors = validateConfig('table', config, columns);
        
        expect(errors).toHaveLength(0);
      });
      
      it('should reject invalid table column', () => {
        const config: VisualizationConfig = {
          columns: ['month', 'invalid_column']
        };
        
        const errors = validateConfig('table', config, columns);
        
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('invalid_column');
      });
    });
    
    describe('chart config', () => {
      it('should validate valid line chart config', () => {
        const config: VisualizationConfig = {
          xColumn: 'month',
          yColumn: 'revenue'
        };
        
        const errors = validateConfig('line_chart', config, columns);
        
        expect(errors).toHaveLength(0);
      });
      
      it('should validate multiple Y columns', () => {
        const config: VisualizationConfig = {
          xColumn: 'month',
          yColumn: ['revenue', 'expenses']
        };
        
        const errors = validateConfig('bar_chart', config, columns);
        
        expect(errors).toHaveLength(0);
      });
      
      it('should reject invalid X column', () => {
        const config: VisualizationConfig = {
          xColumn: 'invalid',
          yColumn: 'revenue'
        };
        
        const errors = validateConfig('line_chart', config, columns);
        
        expect(errors.some(e => e.field === 'config.xColumn')).toBe(true);
      });
      
      it('should reject invalid Y column', () => {
        const config: VisualizationConfig = {
          xColumn: 'month',
          yColumn: 'invalid'
        };
        
        const errors = validateConfig('bar_chart', config, columns);
        
        expect(errors.some(e => e.field === 'config.yColumn')).toBe(true);
      });
      
      it('should require Y column for charts', () => {
        const config: VisualizationConfig = {
          xColumn: 'month'
        };
        
        const errors = validateConfig('scatter', config, columns);
        
        const yError = errors.find(e => e.field === 'config.yColumn');
        expect(yError).toBeDefined();
        expect(yError!.message).toContain('required');
      });
      
      it('should warn about invalid groupBy', () => {
        const config: VisualizationConfig = {
          xColumn: 'month',
          yColumn: 'revenue',
          groupBy: 'invalid'
        };
        
        const errors = validateConfig('bar_chart', config, columns);
        
        const groupError = errors.find(e => e.field === 'config.groupBy');
        expect(groupError).toBeDefined();
        expect(groupError!.severity).toBe('warning');
      });
    });
    
    describe('pie chart config', () => {
      it('should validate valid pie chart config', () => {
        const config: VisualizationConfig = {
          labelColumn: 'category',
          valueColumn: 'revenue'
        };
        
        const errors = validateConfig('pie_chart', config, columns);
        
        expect(errors).toHaveLength(0);
      });
      
      it('should require labelColumn', () => {
        const config: VisualizationConfig = {
          valueColumn: 'revenue'
        };
        
        const errors = validateConfig('pie_chart', config, columns);
        
        const labelError = errors.find(e => e.field === 'config.labelColumn');
        expect(labelError).toBeDefined();
        expect(labelError!.message).toContain('required');
      });
      
      it('should require valueColumn', () => {
        const config: VisualizationConfig = {
          labelColumn: 'category'
        };
        
        const errors = validateConfig('pie_chart', config, columns);
        
        const valueError = errors.find(e => e.field === 'config.valueColumn');
        expect(valueError).toBeDefined();
        expect(valueError!.message).toContain('required');
      });
      
      it('should reject invalid labelColumn', () => {
        const config: VisualizationConfig = {
          labelColumn: 'invalid',
          valueColumn: 'revenue'
        };
        
        const errors = validateConfig('pie_chart', config, columns);
        
        expect(errors.some(e => e.field === 'config.labelColumn')).toBe(true);
      });
    });
  });
});
