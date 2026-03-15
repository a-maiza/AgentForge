'use client';

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  title: string;
  valueLabel?: string;
}

export function PerformanceChart({ data, title, valueLabel = 'Value' }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
              formatter={(value: number) => [value, valueLabel]}
            />
            <Line
              type="monotone"
              dataKey="value"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              className="stroke-primary"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
