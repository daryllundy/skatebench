#!/usr/bin/env node
import React, { useEffect, useMemo, useState } from "react";
import { render, Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readdir, readFile } from "fs/promises";
import { loadSuiteFromFile, testRunner, type TestSuite } from "./index";

function ensureRefUnref(stream: any) {
  if (!stream) return stream;
  if (typeof stream.ref !== "function") stream.ref = () => {};
  if (typeof stream.unref !== "function") stream.unref = () => {};
  return stream;
}

const stdin = ensureRefUnref(process.stdin as any);
const stdout = ensureRefUnref(process.stdout as any);
const stderr = ensureRefUnref(process.stderr as any);

function useBenchRoot() {
  const here = fileURLToPath(import.meta.url);
  return dirname(here);
}

async function findTestSuites(testsDir: string) {
  const entries = await readdir(testsDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));
  const suites: Array<{ filePath: string; suite: TestSuite }> = [];
  for (const f of files) {
    try {
      const filePath = join(testsDir, f.name);
      const raw = await readFile(filePath, "utf-8");
      const json = JSON.parse(raw) as TestSuite;
      if (json && json.name && Array.isArray(json.tests)) {
        suites.push({ filePath, suite: json });
      }
    } catch {
      // ignore malformed files
    }
  }
  return suites;
}

function formatDefaultVersion() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const App: React.FC = () => {
  const benchRoot = useBenchRoot();
  const testsDir = useMemo(() => join(benchRoot, "tests"), [benchRoot]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suites, setSuites] = useState<
    Array<{ filePath: string; suite: TestSuite }>
  >([]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [version, setVersion] = useState<string>(formatDefaultVersion());
  const [stage, setStage] = useState<
    "pickSuite" | "version" | "running" | "done"
  >("pickSuite");

  useEffect(() => {
    (async () => {
      try {
        const found = await findTestSuites(testsDir);
        setSuites(found);
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    })();
  }, [testsDir]);

  useEffect(() => {
    if (stage === "running" && selectedIndex != null) {
      (async () => {
        const entry = suites[selectedIndex];
        const suite = await loadSuiteFromFile(entry.filePath);
        await testRunner({ suite, suiteFilePath: entry.filePath, version });
        setStage("done");
      })();
    }
  }, [stage, selectedIndex, suites, version]);

  if (loading) {
    return (
      <Box>
        <Text>Scanning tests…</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (stage === "pickSuite") {
    if (suites.length === 0) {
      return (
        <Box flexDirection="column">
          <Text>No test suites found in {testsDir}</Text>
        </Box>
      );
    }
    return (
      <Box flexDirection="column">
        <Text>Pick a test suite:</Text>
        <SelectInput
          items={suites.map((s, idx) => ({
            key: String(idx),
            value: idx,
            label: `${s.suite.name}${s.suite.description ? ` — ${s.suite.description}` : ""}`,
          }))}
          onSelect={(item: any) => {
            setSelectedIndex(item.value as number);
            setStage("version");
          }}
        />
      </Box>
    );
  }

  if (stage === "version") {
    return (
      <Box flexDirection="column">
        <Text>Version label (press Enter to start):</Text>
        <Box marginTop={1}>
          <TextInput
            value={version}
            onChange={setVersion}
            onSubmit={() => setStage("running")}
          />
        </Box>
      </Box>
    );
  }

  if (stage === "running") {
    const picked = selectedIndex != null ? suites[selectedIndex] : null;
    return (
      <Box flexDirection="column">
        <Text>
          Running {picked?.suite.name} @ version {version}… Results will appear
          in the console and under results/
          {picked?.suite.id ||
            (picked &&
              picked.suite.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}
          /{version}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>Done. Check the results directory for outputs.</Text>
    </Box>
  );
};

render(<App />, { stdin, stdout, stderr });
