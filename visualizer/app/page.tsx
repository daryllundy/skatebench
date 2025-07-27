"use client";

import { useState } from "react";
import {
  Trophy,
  DollarSign,
  Clock,
  Target,
  TrendingUp,
  Filter,
  ChevronDown,
  Sparkles,
  Calendar,
} from "lucide-react";
import benchmarkData from "../data/benchmark-results.json";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ScatterChart,
  Scatter,
  Cell,
  LabelList,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface ModelData {
  model: string;
  correct: number;
  incorrect: number;
  errors: number;
  totalTests: number;
  successRate: number;
  errorRate: number;
  averageDuration: number;
  totalCost: number;
  averageCostPerTest: number;
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("hsl("))
    return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  if (color.startsWith("rgb("))
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  return color;
}

function getGradientId(prefix: string, model: string) {
  return `${prefix}-${model.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function currency(n: number) {
  return `$${n.toFixed(2)}`;
}

function barValueLabel(suffix: string, decimals: number) {
  return (props: any) => {
    const x = Number(props?.x ?? 0);
    const y = Number(props?.y ?? 0);
    const width = Number(props?.width ?? 0);
    const value = Number(props?.value ?? 0);
    const cx = x + width / 2;
    const cy = y - 6;
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        className="pointer-events-none text-xs font-medium fill-neutral-300"
      >
        {value.toFixed(decimals)}
        {suffix}
      </text>
    );
  };
}

export default function BenchmarkVisualizer() {
  const { rankings, metadata } = benchmarkData as {
    rankings: ModelData[];
    metadata: any;
  };

  const [selectedModels, setSelectedModels] = useState<string[]>(
    rankings.map((m) => m.model)
  );

  const filteredRankings = rankings.filter((m) =>
    selectedModels.includes(m.model)
  );

  const totalTestsPerModel = rankings[0]?.totalTests ?? 0;

  const successRateData = filteredRankings
    .map((m) => ({
      model: m.model,
      successRate: Number(m.successRate.toFixed(1)),
      correct: m.correct,
      total: m.totalTests,
    }))
    .sort((a, b) => b.successRate - a.successRate);

  const costData = filteredRankings
    .map((m) => ({
      model: m.model,
      costPerTest: Number((m.averageCostPerTest * 100).toFixed(3)),
      totalCost: Number(m.totalCost.toFixed(4)),
    }))
    .sort((a, b) => a.costPerTest - b.costPerTest);

  const speedData = filteredRankings
    .map((m) => ({
      model: m.model,
      duration: Number((m.averageDuration / 1000).toFixed(2)),
      durationMs: m.averageDuration,
    }))
    .sort((a, b) => a.duration - b.duration);

  const performanceData = filteredRankings.map((m) => ({
    model: m.model.replace(/-/g, " "),
    originalModel: m.model,
    successRate: m.successRate,
    totalCost: m.totalCost,
    duration: m.averageDuration / 1000,
  }));

  const getModelColor = (modelName: string) => {
    const colors = [
      "hsl(0, 75%, 60%)",
      "hsl(20, 85%, 60%)",
      "hsl(40, 90%, 60%)",
      "hsl(60, 85%, 55%)",
      "hsl(90, 75%, 55%)",
      "hsl(140, 70%, 50%)",
      "hsl(190, 75%, 55%)",
      "hsl(220, 80%, 60%)",
      "hsl(260, 75%, 65%)",
      "hsl(300, 70%, 65%)",
      "hsl(330, 70%, 60%)",
      "hsl(280, 60%, 62%)",
    ];
    const index = rankings.findIndex((r) => r.model === modelName);
    return colors[(index + colors.length) % colors.length];
  };

  const handleModelToggle = (modelName: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelName)
        ? prev.filter((m) => m !== modelName)
        : [...prev, modelName]
    );
  };
  const handleSelectAll = () => setSelectedModels(rankings.map((m) => m.model));
  const handleDeselectAll = () => setSelectedModels([]);

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_800px_at_10%_0%,rgba(59,130,246,0.18),transparent_70%),radial-gradient(1200px_800px_at_90%_0%,rgba(34,197,94,0.14),transparent_70%),radial-gradient(900px_700px_at_50%_100%,rgba(234,88,12,0.14),transparent_70%)]" />

      <header className="relative mx-auto max-w-7xl px-4 pt-6 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-green-500/20 via-blue-500/20 to-purple-500/20 p-2 ring-1 ring-white/10">
              <Sparkles className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Model Benchmark Visualizer
              </h1>
              <p className="mt-1 max-w-prose text-xs text-neutral-300 sm:text-sm">
                {metadata?.testSuite || "Benchmark"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-neutral-800/60 text-neutral-200"
            >
              {metadata?.totalModels ?? rankings.length} models
            </Badge>
            {metadata?.timestamp ? (
              <Badge
                variant="outline"
                className="border-neutral-700 text-neutral-300"
              >
                <Calendar className="mr-1 h-3.5 w-3.5" />
                {new Date(metadata.timestamp).toLocaleString()}
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-16">
        <Tabs defaultValue="accuracy" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="max-w-full overflow-x-auto whitespace-nowrap rounded-xl border border-neutral-800 bg-neutral-900/70 p-1">
              <TabsTrigger
                value="accuracy"
                className="flex items-center gap-2 rounded-md px-4 py-2 text-neutral-300 data-[state=active]:bg-green-600 data-[state=active]:text-white"
              >
                <Target className="h-4 w-4" /> Accuracy
              </TabsTrigger>
              <TabsTrigger
                value="cost"
                className="flex items-center gap-2 rounded-md px-4 py-2 text-neutral-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <DollarSign className="h-4 w-4" /> Cost
              </TabsTrigger>
              <TabsTrigger
                value="speed"
                className="flex items-center gap-2 rounded-md px-4 py-2 text-neutral-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
              >
                <Clock className="h-4 w-4" /> Speed
              </TabsTrigger>
              <TabsTrigger
                value="combined"
                className="flex items-center gap-2 rounded-md px-4 py-2 text-neutral-300 data-[state=active]:bg-orange-600 data-[state=active]:text-white"
              >
                <TrendingUp className="h-4 w-4" /> Combined
              </TabsTrigger>
            </TabsList>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full border-neutral-700 bg-neutral-900/60 text-white hover:bg-neutral-800 sm:w-auto"
                >
                  <Filter className="mr-2 h-4 w-4" /> Models (
                  {selectedModels.length}/{rankings.length})
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-96 border-neutral-700 bg-neutral-900/95 text-white backdrop-blur">
                <DropdownMenuLabel className="text-neutral-200">
                  Select models
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-neutral-700" />
                <div className="flex gap-2 p-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAll}
                    className="flex-1 border-neutral-600 bg-neutral-800 hover:bg-neutral-700"
                  >
                    Select all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeselectAll}
                    className="flex-1 border-neutral-600 bg-neutral-800 hover:bg-neutral-700"
                  >
                    Clear
                  </Button>
                </div>
                <DropdownMenuSeparator className="bg-neutral-700" />
                <ScrollArea className="h-80">
                  {rankings.map((m) => (
                    <DropdownMenuItem
                      key={m.model}
                      className="group flex items-center gap-3 py-2 hover:bg-neutral-800 focus:bg-neutral-800"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Checkbox
                        id={m.model}
                        checked={selectedModels.includes(m.model)}
                        onCheckedChange={() => handleModelToggle(m.model)}
                        className="border-neutral-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: getModelColor(m.model) }}
                        />
                        <label
                          htmlFor={m.model}
                          className="cursor-pointer truncate text-sm text-neutral-200"
                        >
                          {m.model}
                        </label>
                      </div>
                      <Badge className="ml-auto bg-neutral-800 text-neutral-200">
                        {m.successRate.toFixed(1)}%
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsContent value="accuracy">
            <Card className="border-neutral-800 bg-neutral-900/70 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Trophy className="h-5 w-5 text-green-400" /> Success rate by
                  model
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Percentage of correct answers out of {totalTestsPerModel}{" "}
                  tests per model
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
                  className="h-[420px] sm:h-[520px]"
                >
                  <BarChart
                    data={successRateData}
                    margin={{ top: 10, right: 24, left: 12, bottom: 64 }}
                  >
                    <defs>
                      {successRateData.map((d) => {
                        const base = getModelColor(d.model);
                        const id = getGradientId("sr", d.model);
                        return (
                          <linearGradient
                            key={id}
                            id={id}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={withAlpha(base, 0.95)}
                            />
                            <stop
                              offset="100%"
                              stopColor={withAlpha(base, 0.55)}
                            />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#303341" />
                    <XAxis
                      dataKey="model"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                      stroke="#9ca3af"
                    />
                    <YAxis
                      label={{
                        value: "Success Rate (%)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#9ca3af",
                      }}
                      stroke="#9ca3af"
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: any) => [`${value}%`, "Success Rate"]}
                      labelFormatter={(label: string) => `Model: ${label}`}
                    />
                    <Bar dataKey="successRate" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="successRate"
                        position="top"
                        content={barValueLabel("%", 1)}
                      />
                      {successRateData.map((entry) => (
                        <Cell
                          key={entry.model}
                          fill={`url(#${getGradientId("sr", entry.model)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cost">
            <Card className="border-neutral-800 bg-neutral-900/70 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <DollarSign className="h-5 w-5 text-blue-400" /> Cost
                  efficiency by model
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
                  className="h-[420px] sm:h-[520px]"
                >
                  <BarChart
                    data={costData}
                    margin={{ top: 10, right: 24, left: 12, bottom: 64 }}
                  >
                    <defs>
                      {costData.map((d) => {
                        const base = getModelColor(d.model);
                        const id = getGradientId("ct", d.model);
                        return (
                          <linearGradient
                            key={id}
                            id={id}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={withAlpha(base, 0.95)}
                            />
                            <stop
                              offset="100%"
                              stopColor={withAlpha(base, 0.55)}
                            />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#303341" />
                    <XAxis
                      dataKey="model"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                      stroke="#9ca3af"
                    />
                    <YAxis
                      label={{
                        value: "Cost per Test (¢)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#9ca3af",
                      }}
                      stroke="#9ca3af"
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: any) => [`${value}¢`, "Cost per Test"]}
                      labelFormatter={(label: string) => `Model: ${label}`}
                    />
                    <Bar dataKey="costPerTest" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="costPerTest"
                        position="top"
                        content={barValueLabel("¢", 2)}
                      />
                      {costData.map((entry) => (
                        <Cell
                          key={entry.model}
                          fill={`url(#${getGradientId("ct", entry.model)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="speed">
            <Card className="border-neutral-800 bg-neutral-900/70 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Clock className="h-5 w-5 text-purple-400" /> Response speed
                  by model
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
                  className="h-[420px] sm:h-[520px]"
                >
                  <BarChart
                    data={speedData}
                    margin={{ top: 10, right: 24, left: 12, bottom: 64 }}
                  >
                    <defs>
                      {speedData.map((d) => {
                        const base = getModelColor(d.model);
                        const id = getGradientId("sp", d.model);
                        return (
                          <linearGradient
                            key={id}
                            id={id}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={withAlpha(base, 0.95)}
                            />
                            <stop
                              offset="100%"
                              stopColor={withAlpha(base, 0.55)}
                            />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#303341" />
                    <XAxis
                      dataKey="model"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                      stroke="#9ca3af"
                    />
                    <YAxis
                      label={{
                        value: "Response Time (s)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#9ca3af",
                      }}
                      stroke="#9ca3af"
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: any) => [`${value}s`, "Response Time"]}
                      labelFormatter={(label: string) => `Model: ${label}`}
                    />
                    <Bar dataKey="duration" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="duration"
                        position="top"
                        content={barValueLabel("s", 2)}
                      />
                      {speedData.map((entry) => (
                        <Cell
                          key={entry.model}
                          fill={`url(#${getGradientId("sp", entry.model)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="combined">
            <Card className="border-neutral-800 bg-neutral-900/70 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5 text-orange-400" /> Performance
                  vs total cost
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Top‑left is ideal: higher accuracy, lower total cost
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
                  className="h-[420px] sm:h-[520px]"
                >
                  <ScatterChart
                    margin={{ top: 10, right: 120, left: 12, bottom: 32 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#303341" />
                    <XAxis
                      type="number"
                      dataKey="totalCost"
                      name="Total Cost"
                      label={{
                        value: "Total Cost ($)",
                        position: "insideBottom",
                        offset: -20,
                        fill: "#9ca3af",
                      }}
                      stroke="#9ca3af"
                      domain={[0, "auto"]}
                      tickFormatter={(tick) => tick.toFixed(2)}
                    />
                    <YAxis
                      type="number"
                      dataKey="successRate"
                      name="Success Rate"
                      unit="%"
                      label={{
                        value: "Success Rate (%)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#9ca3af",
                      }}
                      stroke="#9ca3af"
                      domain={[0, 100]}
                    />
                    <ChartTooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload as any;
                          return (
                            <div className="rounded-lg border border-white/10 bg-neutral-900/95 p-3 text-neutral-100 shadow-xl">
                              <p className="font-semibold">{d.model}</p>
                              <p className="text-sm text-neutral-300">
                                Success: {d.successRate.toFixed(1)}%
                              </p>
                              <p className="text-sm text-neutral-300">
                                Total cost: {currency(d.totalCost)}
                              </p>
                              <p className="text-sm text-neutral-300">
                                Time: {d.duration.toFixed(2)}s
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter data={performanceData} isAnimationActive={false}>
                      {performanceData.map((entry) => (
                        <Cell
                          key={entry.originalModel}
                          fill={getModelColor(entry.originalModel)}
                        />
                      ))}
                      <LabelList
                        dataKey="model"
                        content={({ x, y, value }: any) => {
                          const nx =
                            (typeof x === "number" ? x : Number(x)) || 0;
                          const ny =
                            (typeof y === "number" ? y : Number(y)) || 0;
                          return (
                            <text
                              x={nx + 10}
                              y={ny}
                              dy={4}
                              textAnchor="left"
                              className="pointer-events-none text-xs font-medium fill-neutral-200"
                              style={{
                                textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                              }}
                            >
                              {String(value)}
                            </text>
                          );
                        }}
                      />
                    </Scatter>
                  </ScatterChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
