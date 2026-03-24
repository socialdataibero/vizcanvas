"use client";

import React, { useState, useEffect } from "react";
import { DAGNode } from "@/engine/types";
import { JavaScriptConfig } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";

interface Props {
  node: DAGNode;
  expandTablePreview?: boolean;
}

export default function JSNodeBody({ node, expandTablePreview = false }: Props) {
  const config = node.config as JavaScriptConfig;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const [code, setCode] = useState(config.code || "// input is available\nreturn input;");
  const [output, setOutput] = useState<string>("");
  const maxPreviewChars = expandTablePreview ? 2000 : 500;

  useEffect(() => {
    setCode(config.code || "// input is available\nreturn input;");
  }, [config.code]);

  useEffect(() => {
    if (node.result) {
      const serialized = JSON.stringify(node.result.rows, null, 2);
      setOutput(
        serialized.length > maxPreviewChars
          ? `${serialized.slice(0, maxPreviewChars)}\n...`
          : serialized
      );
      return;
    }

    if (node.error) {
      setOutput(node.error);
      return;
    }

    setOutput("");
  }, [maxPreviewChars, node.error, node.result]);

  const handleRun = () => {
    updateNodeConfig(node.id, { code } as Partial<JavaScriptConfig>);
  };

  return (
    <div className={`flex min-h-0 flex-col gap-2 no-drag ${expandTablePreview ? "h-full" : ""}`}>
      <div className="flex-shrink-0">
        <label className="text-[10px] font-medium text-gray-500 uppercase">JavaScript (Experimental)</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleRun();
            }
          }}
          rows={5}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs font-mono outline-none focus:border-orange-400 resize-y"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={handleRun}
          className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
        >
          ▶ Run
        </button>
        <span className="text-[10px] text-gray-400">⌘+Enter</span>
      </div>

      {output && (
        <pre className={`subtle-scrollbar rounded-md p-2 text-xs font-mono text-gray-700 overflow-auto whitespace-pre-wrap ${
          expandTablePreview ? "min-h-0 flex-1" : "max-h-[150px]"
        } ${node.error ? "border border-red-200 bg-red-50 text-red-600" : "bg-gray-50"}`}>
          {output}
        </pre>
      )}
    </div>
  );
}
