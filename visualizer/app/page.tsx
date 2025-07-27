"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  LabelList,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import benchmarkData from "../data/benchmark-results.json"
import { Trophy, DollarSign, Clock, Target, TrendingUp, Filter, ChevronDown } from "lucide-react"
import { useState } from "react"

interface ModelData {
  model: string
  correct: number
  incorrect: number
  errors: number
  totalTests: number
  successRate: number
  errorRate: number
  averageDuration: number
  totalCost: number
  averageCostPerTest: number
}

export default function BenchmarkVisualizer() {
  const { rankings, metadata } = benchmarkData

  // State for selected models
  const [selectedModels, setSelectedModels] = useState<string[]>(rankings.map((model: ModelData) => model.model))

  // Filter data based on selected models
  const filteredRankings = rankings.filter((model: ModelData) => selectedModels.includes(model.model))

  // Prepare data for charts
  const successRateData = filteredRankings
    .map((model: ModelData) => ({
      model: model.model,
      successRate: Number(model.successRate.toFixed(1)),
      correct: model.correct,
      total: model.totalTests,
    }))
    .sort((a, b) => b.successRate - a.successRate)

  const costData = filteredRankings
    .map((model: ModelData) => ({
      model: model.model,
      costPerTest: Number((model.averageCostPerTest * 1000).toFixed(3)), // Convert to cents for better readability
      totalCost: Number(model.totalCost.toFixed(4)),
    }))
    .sort((a, b) => a.costPerTest - b.costPerTest)

  const speedData = filteredRankings
    .map((model: ModelData) => ({
      model: model.model,
      duration: Number((model.averageDuration / 1000).toFixed(2)), // Convert to seconds
      durationMs: model.averageDuration,
    }))
    .sort((a, b) => a.duration - b.duration)

  // Combined performance data for scatter plot
  const performanceData = filteredRankings.map((model: ModelData) => ({
    model: model.model.replace(/-/g, " "),
    originalModel: model.model, // Keep original name for color lookup
    successRate: model.successRate,
    totalCost: model.totalCost,
    duration: model.averageDuration / 1000, // in seconds
  }))

  const getModelColor = (modelName: string) => {
    const colors = [
      "hsl(0, 70%, 60%)", // Red
      "hsl(30, 70%, 60%)", // Orange
      "hsl(60, 70%, 60%)", // Yellow
      "hsl(90, 70%, 60%)", // Light Green
      "hsl(120, 70%, 60%)", // Green
      "hsl(150, 70%, 60%)", // Teal
      "hsl(180, 70%, 60%)", // Cyan
      "hsl(210, 70%, 60%)", // Light Blue
      "hsl(240, 70%, 60%)", // Blue
      "hsl(270, 70%, 60%)", // Purple
      "hsl(300, 70%, 60%)", // Magenta
      "hsl(330, 70%, 60%)", // Pink
    ]
    // Use original rankings to ensure consistent color mapping
    const index = rankings.findIndex((r) => r.model === modelName)
    return colors[index % colors.length]
  }

  const handleModelToggle = (modelName: string) => {
    setSelectedModels((prev) => (prev.includes(modelName) ? prev.filter((m) => m !== modelName) : [...prev, modelName]))
  }

  const handleSelectAll = () => {
    setSelectedModels(rankings.map((model: ModelData) => model.model))
  }

  const handleDeselectAll = () => {
    setSelectedModels([])
  }

  const renderCustomizedLabel = (props: any) => {
    const { x, y, value } = props
    return (
      <text
        x={x + 10}
        y={y}
        dy={4}
        textAnchor="left"
        className="fill-neutral-200 text-xs font-medium pointer-events-none"
        style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
      >
        {value}
      </text>
    )
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Model Selector */}
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700">
                <Filter className="h-4 w-4 mr-2" />
                Models ({selectedModels.length}/{rankings.length})
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 bg-neutral-800 border-neutral-700 text-white max-h-96 overflow-y-auto">
              <DropdownMenuLabel className="text-neutral-200">Select Models to Display</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-neutral-700" />
              <div className="flex gap-2 p-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAll}
                  className="flex-1 bg-neutral-700 border-neutral-600 text-white hover:bg-neutral-600"
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeselectAll}
                  className="flex-1 bg-neutral-700 border-neutral-600 text-white hover:bg-neutral-600"
                >
                  Clear All
                </Button>
              </div>
              <DropdownMenuSeparator className="bg-neutral-700" />
              {rankings.map((model: ModelData) => (
                <DropdownMenuItem
                  key={model.model}
                  className="flex items-center space-x-2 hover:bg-neutral-700 focus:bg-neutral-700"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Checkbox
                    id={model.model}
                    checked={selectedModels.includes(model.model)}
                    onCheckedChange={() => handleModelToggle(model.model)}
                    className="border-neutral-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getModelColor(model.model) }} />
                    <label htmlFor={model.model} className="text-sm cursor-pointer text-neutral-200">
                      {model.model}
                    </label>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs defaultValue="accuracy" className="space-y-6">
          <TabsContent value="accuracy">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Trophy className="h-5 w-5 text-green-500" />
                  Success Rate by Model
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Percentage of correct answers out of {rankings[0]?.totalTests || 0} tests per model
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    successRate: {
                      label: "Success Rate",
                      color: "hsl(142, 76%, 36%)",
                    },
                  }}
                  className="h-[500px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={successRateData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="model" angle={-45} textAnchor="end" height={100} fontSize={12} stroke="#d1d5db" />
                      <YAxis
                        label={{ value: "Success Rate (%)", angle: -90, position: "insideLeft", fill: "#d1d5db" }}
                        stroke="#d1d5db"
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value: any, name: string) => [`${value}%`, "Success Rate"]}
                        labelFormatter={(label: string) => `Model: ${label}`}
                      />
                      <Bar dataKey="successRate" radius={[4, 4, 0, 0]}>
                        {successRateData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getModelColor(entry.model)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cost">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                  Cost Efficiency by Model
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Average cost per test in cents (lower is better)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    costPerTest: {
                      label: "Cost per Test",
                      color: "hsl(217, 91%, 60%)",
                    },
                  }}
                  className="h-[500px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="model" angle={-45} textAnchor="end" height={100} fontSize={12} stroke="#d1d5db" />
                      <YAxis
                        label={{ value: "Cost per Test (¢)", angle: -90, position: "insideLeft", fill: "#d1d5db" }}
                        stroke="#d1d5db"
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value: any, name: string) => [`${value}¢`, "Cost per Test"]}
                        labelFormatter={(label: string) => `Model: ${label}`}
                      />
                      <Bar dataKey="costPerTest" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="costPerTest" position="top" className="fill-neutral-300 text-xs" />
                        {costData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getModelColor(entry.model)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="speed">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Clock className="h-5 w-5 text-purple-500" />
                  Response Speed by Model
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Average response time in seconds (lower is better)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    duration: {
                      label: "Response Time",
                      color: "hsl(262, 83%, 58%)",
                    },
                  }}
                  className="h-[500px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={speedData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="model" angle={-45} textAnchor="end" height={100} fontSize={12} stroke="#d1d5db" />
                      <YAxis
                        label={{
                          value: "Response Time (seconds)",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#d1d5db",
                        }}
                        stroke="#d1d5db"
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value: any, name: string) => [`${value}s`, "Response Time"]}
                        labelFormatter={(label: string) => `Model: ${label}`}
                      />
                      <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="duration" position="top" className="fill-neutral-300 text-xs" />
                        {speedData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getModelColor(entry.model)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="combined">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  Performance vs Total Cost Analysis
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Success rate vs total cost - models in the top-left are ideal (high accuracy, low cost)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    successRate: {
                      label: "Success Rate",
                      color: "hsl(142, 76%, 36%)",
                    },
                  }}
                  className="h-[500px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 120, left: 20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        type="number"
                        dataKey="totalCost"
                        name="Total Cost"
                        label={{ value: "Total Cost ($)", position: "insideBottom", offset: -20, fill: "#d1d5db" }}
                        stroke="#d1d5db"
                        domain={[0, "auto"]}
                        tickFormatter={(tick) => tick.toFixed(2)}
                      />
                      <YAxis
                        type="number"
                        dataKey="successRate"
                        name="Success Rate"
                        unit="%"
                        label={{ value: "Success Rate (%)", angle: -90, position: "insideLeft", fill: "#d1d5db" }}
                        stroke="#d1d5db"
                        domain={[0, 100]}
                      />
                      <ChartTooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-white p-3 border rounded-lg shadow-lg text-black">
                                <p className="font-semibold">{data.model}</p>
                                <p className="text-sm">Success Rate: {data.successRate.toFixed(1)}%</p>
                                <p className="text-sm">Total Cost: ${data.totalCost.toFixed(2)}</p>
                                <p className="text-sm">Response Time: {data.duration.toFixed(2)}s</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Scatter data={performanceData} isAnimationActive={false}>
                        {performanceData.map((entry) => (
                          <Cell key={`cell-${entry.originalModel}`} fill={getModelColor(entry.originalModel)} />
                        ))}
                        <LabelList dataKey="model" content={renderCustomizedLabel} />
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <div className="flex justify-center">
            <TabsList className="bg-neutral-800 border border-neutral-700 p-1 rounded-lg">
              <TabsTrigger
                value="accuracy"
                className="flex items-center gap-2 px-4 py-2 rounded-md text-neutral-300 hover:text-white hover:bg-neutral-700 data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all"
              >
                <Target className="h-4 w-4" />
                Accuracy
              </TabsTrigger>
              <TabsTrigger
                value="cost"
                className="flex items-center gap-2 px-4 py-2 rounded-md text-neutral-300 hover:text-white hover:bg-neutral-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all"
              >
                <DollarSign className="h-4 w-4" />
                Cost
              </TabsTrigger>
              <TabsTrigger
                value="speed"
                className="flex items-center gap-2 px-4 py-2 rounded-md text-neutral-300 hover:text-white hover:bg-neutral-700 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all"
              >
                <Clock className="h-4 w-4" />
                Speed
              </TabsTrigger>
              <TabsTrigger
                value="combined"
                className="flex items-center gap-2 px-4 py-2 rounded-md text-neutral-300 hover:text-white hover:bg-neutral-700 data-[state=active]:bg-orange-600 data-[state=active]:text-white transition-all"
              >
                <TrendingUp className="h-4 w-4" />
                Combined
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* Summary Statistics */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">Benchmark Summary</CardTitle>
            <CardDescription className="text-neutral-400">
              Overall statistics from the test run ({selectedModels.length} models selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{selectedModels.length}</div>
                <div className="text-sm text-neutral-400">Models Selected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{selectedModels.length * 35}</div>
                <div className="text-sm text-neutral-400">Total Tests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {filteredRankings.length > 0
                    ? (
                        filteredRankings.reduce((sum, model) => sum + model.successRate, 0) / filteredRankings.length
                      ).toFixed(1)
                    : 0}
                  %
                </div>
                <div className="text-sm text-neutral-400">Avg Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">
                  ${filteredRankings.reduce((sum, model) => sum + model.totalCost, 0).toFixed(2)}
                </div>
                <div className="text-sm text-neutral-400">Total Cost</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
