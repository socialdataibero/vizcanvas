"use client";

import React, { useState, useEffect } from "react";
import { DAGNode } from "@/engine/types";
import { JavaScriptConfig } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";

interface Props {
  node: DAGNode;
}

export default function JSNodeBody({ node }: Props) {
  const config = node.config as JavaScriptConfig;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const upstreamIds = useDagStore((s) => s.getUpstreamNodeIds(node.id));
  const upstreamNode = useDagStore((s) => upstreamIds[0] ? s.nodes[upstreamIds[0]] : undefined);
  const [code, setCode] = useState(config.code || "// input is available\nreturn input;");
  const [output, setOutput] = useState<string>("");

  useEffect(() => {
    setCode(config.code || "// input is available\nreturn input;");
  }, [config.code]);

  const handleRun = () => {
    updateNodeConfig(node.id, { code } as Partial<JavaScriptConfig>);
    try {
      const input = upstreamNode?.result?.rows || [];
      // eslint-disable-next-line no-new-func
      const fn = new Function("input", code);
      const result = fn(input);
      setOutput(JSON.stringify(result, null, 2).slice(0, 500));
    } catch (err) {
      setOutput(`Error: ${err}`);
    }
  };

  return (
    <div className="space-y-2 no-drag">
      <div>
        <label className="text-[10px] font-medium text-gray-500 uppercase">JavaScript (Experimental)</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={5}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs font-mono outline-none focus:border-indigo-400 resize-y"
          spellCheck={false}
        />
      </div>

      <button
        onClick={handleRun}
        className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 w-full"
      >
        ▶ Run
      </button>

      {output && (
        <pre className="rounded-md bg-gray-50 p-2 text-xs font-mono text-gray-700 max-h-[150px] overflow-auto whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </div>
  );
}
