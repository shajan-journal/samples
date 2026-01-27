import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'

interface TrendChartProps {
  data: any[]
}

export function TrendChart({ data }: TrendChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-secondary)', padding: 20 }}>No data available</div>
  }

  const chartData = [...data]
    .reverse()
    .map(run => ({
      date: format(new Date(run.timestamp), 'MM/dd'),
      allPass: run.all_metrics_pass_pct,
      correctness: run.avg_correctness * 100,
      faithfulness: run.avg_faithfulness * 100,
      toolCoverage: run.avg_tool_call_coverage * 100,
      commit: run.api_commit_sha?.slice(0, 7),
    }))

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            stroke="#666"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="#666"
            fontSize={11}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: '#242424',
              border: '1px solid #333',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: number) => `${value.toFixed(1)}%`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="allPass"
            name="All Pass %"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="correctness"
            name="Correctness"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="faithfulness"
            name="Faithfulness"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="toolCoverage"
            name="Tool Coverage"
            stroke="#ec4899"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
