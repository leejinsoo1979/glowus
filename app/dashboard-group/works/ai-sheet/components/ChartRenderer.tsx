'use client'

import { useMemo } from 'react'
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    ScatterChart,
    Scatter,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ComposedChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LabelList
} from 'recharts'
import type { ChartConfig } from '../lib/charts'
import { formatChartValue, CHART_COLORS } from '../lib/charts'

interface ChartRendererProps {
    config: ChartConfig
    width?: number | string
    height?: number | string
}

export function ChartRenderer({ config, width = '100%', height = 300 }: ChartRendererProps) {
    const {
        type,
        title,
        data,
        series,
        xAxisKey,
        showLegend,
        showGrid,
        showValues,
        legendPosition,
        colors = CHART_COLORS
    } = config

    const legendProps = useMemo(() => {
        switch (legendPosition) {
            case 'top': return { verticalAlign: 'top' as const, align: 'center' as const }
            case 'bottom': return { verticalAlign: 'bottom' as const, align: 'center' as const }
            case 'left': return { verticalAlign: 'middle' as const, align: 'left' as const, layout: 'vertical' as const }
            case 'right': return { verticalAlign: 'middle' as const, align: 'right' as const, layout: 'vertical' as const }
            default: return { verticalAlign: 'bottom' as const, align: 'center' as const }
        }
    }, [legendPosition])

    const commonAxisProps = {
        tick: { fontSize: 12 },
        tickLine: false
    }

    const renderChart = () => {
        switch (type) {
            case 'column':
                return (
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
                        <XAxis dataKey={xAxisKey} {...commonAxisProps} />
                        <YAxis {...commonAxisProps} tickFormatter={(v) => formatChartValue(v, true)} />
                        <Tooltip
                            formatter={(value: number) => formatChartValue(value)}
                            contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        {showLegend && <Legend {...legendProps} />}
                        {series.map((s, idx) => (
                            <Bar
                                key={s.dataKey}
                                dataKey={s.dataKey}
                                name={s.name}
                                fill={s.color || colors[idx % colors.length]}
                                radius={[4, 4, 0, 0]}
                            >
                                {showValues && (
                                    <LabelList
                                        dataKey={s.dataKey}
                                        position="top"
                                        formatter={(v: number) => formatChartValue(v, true)}
                                        style={{ fontSize: 10, fill: '#666' }}
                                    />
                                )}
                            </Bar>
                        ))}
                    </BarChart>
                )

            case 'bar':
                return (
                    <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 5 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
                        <XAxis type="number" {...commonAxisProps} tickFormatter={(v) => formatChartValue(v, true)} />
                        <YAxis dataKey={xAxisKey} type="category" {...commonAxisProps} width={70} />
                        <Tooltip
                            formatter={(value: number) => formatChartValue(value)}
                            contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        {showLegend && <Legend {...legendProps} />}
                        {series.map((s, idx) => (
                            <Bar
                                key={s.dataKey}
                                dataKey={s.dataKey}
                                name={s.name}
                                fill={s.color || colors[idx % colors.length]}
                                radius={[0, 4, 4, 0]}
                            >
                                {showValues && (
                                    <LabelList
                                        dataKey={s.dataKey}
                                        position="right"
                                        formatter={(v: number) => formatChartValue(v, true)}
                                        style={{ fontSize: 10, fill: '#666' }}
                                    />
                                )}
                            </Bar>
                        ))}
                    </BarChart>
                )

            case 'line':
                return (
                    <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
                        <XAxis dataKey={xAxisKey} {...commonAxisProps} />
                        <YAxis {...commonAxisProps} tickFormatter={(v) => formatChartValue(v, true)} />
                        <Tooltip
                            formatter={(value: number) => formatChartValue(value)}
                            contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        {showLegend && <Legend {...legendProps} />}
                        {series.map((s, idx) => (
                            <Line
                                key={s.dataKey}
                                type="monotone"
                                dataKey={s.dataKey}
                                name={s.name}
                                stroke={s.color || colors[idx % colors.length]}
                                strokeWidth={2}
                                dot={{ r: 4, strokeWidth: 2 }}
                                activeDot={{ r: 6 }}
                            >
                                {showValues && (
                                    <LabelList
                                        dataKey={s.dataKey}
                                        position="top"
                                        formatter={(v: number) => formatChartValue(v, true)}
                                        style={{ fontSize: 10, fill: '#666' }}
                                    />
                                )}
                            </Line>
                        ))}
                    </LineChart>
                )

            case 'area':
                return (
                    <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
                        <XAxis dataKey={xAxisKey} {...commonAxisProps} />
                        <YAxis {...commonAxisProps} tickFormatter={(v) => formatChartValue(v, true)} />
                        <Tooltip
                            formatter={(value: number) => formatChartValue(value)}
                            contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        {showLegend && <Legend {...legendProps} />}
                        {series.map((s, idx) => (
                            <Area
                                key={s.dataKey}
                                type="monotone"
                                dataKey={s.dataKey}
                                name={s.name}
                                stroke={s.color || colors[idx % colors.length]}
                                fill={s.color || colors[idx % colors.length]}
                                fillOpacity={0.3}
                                strokeWidth={2}
                            />
                        ))}
                    </AreaChart>
                )

            case 'pie':
            case 'doughnut':
                const pieData = data.map((d, idx) => ({
                    ...d,
                    fill: colors[idx % colors.length]
                }))
                const innerRadius = type === 'doughnut' ? '50%' : 0

                return (
                    <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={innerRadius}
                            outerRadius="80%"
                            paddingAngle={2}
                            label={showValues ? ({
                                name,
                                percent
                            }: {
                                name: string
                                percent: number
                            }) => `${name}: ${(percent * 100).toFixed(0)}%` : false}
                            labelLine={showValues}
                        >
                            {pieData.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => formatChartValue(value)}
                            contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        {showLegend && <Legend {...legendProps} />}
                    </PieChart>
                )

            case 'scatter':
                return (
                    <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
                        <XAxis dataKey="x" type="number" {...commonAxisProps} name="X" />
                        <YAxis dataKey="y" type="number" {...commonAxisProps} name="Y" />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            formatter={(value: number) => formatChartValue(value)}
                            contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        {showLegend && <Legend {...legendProps} />}
                        <Scatter
                            name="Data"
                            data={data}
                            fill={colors[0]}
                        />
                    </ScatterChart>
                )

            case 'radar':
                return (
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                            formatter={(value: number) => formatChartValue(value)}
                            contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        {showLegend && <Legend {...legendProps} />}
                        {series.map((s, idx) => (
                            <Radar
                                key={s.dataKey}
                                name={s.name}
                                dataKey={s.dataKey}
                                stroke={s.color || colors[idx % colors.length]}
                                fill={s.color || colors[idx % colors.length]}
                                fillOpacity={0.3}
                            />
                        ))}
                    </RadarChart>
                )

            case 'combo':
                return (
                    <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
                        <XAxis dataKey={xAxisKey} {...commonAxisProps} />
                        <YAxis {...commonAxisProps} tickFormatter={(v) => formatChartValue(v, true)} />
                        <Tooltip
                            formatter={(value: number) => formatChartValue(value)}
                            contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        {showLegend && <Legend {...legendProps} />}
                        {series.map((s, idx) => {
                            const chartType = s.type || (idx === 0 ? 'bar' : 'line')
                            if (chartType === 'bar') {
                                return (
                                    <Bar
                                        key={s.dataKey}
                                        dataKey={s.dataKey}
                                        name={s.name}
                                        fill={s.color || colors[idx % colors.length]}
                                        radius={[4, 4, 0, 0]}
                                    />
                                )
                            } else {
                                return (
                                    <Line
                                        key={s.dataKey}
                                        type="monotone"
                                        dataKey={s.dataKey}
                                        name={s.name}
                                        stroke={s.color || colors[idx % colors.length]}
                                        strokeWidth={2}
                                        dot={{ r: 4 }}
                                    />
                                )
                            }
                        })}
                    </ComposedChart>
                )

            default:
                return null
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            {title && (
                <h3 className="text-center text-sm font-medium text-gray-700 mb-4">
                    {title}
                </h3>
            )}
            <ResponsiveContainer width={width} height={height}>
                {renderChart() || <div />}
            </ResponsiveContainer>
        </div>
    )
}
