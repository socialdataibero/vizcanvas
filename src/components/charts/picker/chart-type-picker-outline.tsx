import * as React from "react";
import {
  ChartColumns,
  chartIconGroups,
  chartIconRegistry,
  type ChartIconName,
} from "./chart-icons-lucide-outline";

const groupOrder = ["comparison", "distribution", "time", "relationship", "part-to-whole", "maps", "flow"] as const;

type GroupKey = (typeof groupOrder)[number];

const groupLabels: Record<GroupKey, string> = {
  "comparison": "COMPARISON",
  "distribution": "DISTRIBUTION",
  "time": "TIME",
  "relationship": "RELATIONSHIP",
  "part-to-whole": "PART-TO-WHOLE",
  "maps": "MAPS",
  "flow": "FLOW"
} as Record<GroupKey, string>;

const groupRepresentatives: Record<GroupKey, [ChartIconName, ChartIconName]> = {
  "comparison": [
    "ChartColumns",
    "ChartDotPlot"
  ],
  "distribution": [
    "ChartHistogram",
    "ChartBoxPlot"
  ],
  "time": [
    "ChartTemporal",
    "ChartLine"
  ],
  "relationship": [
    "ChartScatter",
    "ChartBubble"
  ],
  "part-to-whole": [
    "ChartStacked",
    "ChartTreemap"
  ],
  "maps": [
    "ChartChoropleth",
    "ChartBubbleMap"
  ],
  "flow": [
    "ChartArcMap",
    "ChartSankey"
  ]
} as Record<GroupKey, [ChartIconName, ChartIconName]>;

const itemLookup = Object.fromEntries(
  groupOrder.flatMap((groupKey) =>
    chartIconGroups[groupKey].map((item) => [item.name, { ...item, groupKey }]),
  ),
) as Record<
  ChartIconName,
  (typeof chartIconGroups)[GroupKey][number] & { groupKey: GroupKey }
>;

const styles = `
.chartTypePickerOutline {
  --ctp-bg: #f6f7f8;
  --ctp-panel: #ffffff;
  --ctp-subtle: #fbfbfc;
  --ctp-line: #e4e7ec;
  --ctp-line-strong: #d0d5dd;
  --ctp-ink: #344054;
  --ctp-ink-strong: #101828;
  --ctp-muted: #667085;
  --ctp-shadow: 0 10px 30px rgba(16, 24, 40, 0.06);
  width: min(1400px, 100%);
  padding: 18px;
  border-radius: 28px;
  border: 1px solid var(--ctp-line);
  background: linear-gradient(180deg, #ffffff, #fafafb);
  color: var(--ctp-ink);
  box-shadow: var(--ctp-shadow);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.chartTypePickerOutline * {
  box-sizing: border-box;
}

.chartTypePickerOutline button,
.chartTypePickerOutline input {
  font: inherit;
}

.chartTypePickerOutline__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.chartTypePickerOutline__titleWrap {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.chartTypePickerOutline__titleIcon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid var(--ctp-line);
  background: var(--ctp-subtle);
  display: grid;
  place-items: center;
  color: var(--ctp-muted);
}

.chartTypePickerOutline__eyebrow {
  margin: 0 0 4px;
  color: #98a2b3;
  font-size: 11px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.chartTypePickerOutline__title {
  margin: 0;
  color: var(--ctp-ink-strong);
  font-size: 20px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.chartTypePickerOutline__meta {
  margin: 2px 0 0;
  color: var(--ctp-muted);
  font-size: 13px;
}

.chartTypePickerOutline__search {
  min-width: 300px;
  max-width: 360px;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--ctp-line);
  background: #fff;
  color: #98a2b3;
}

.chartTypePickerOutline__searchInput {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ctp-ink);
  font-size: 14px;
}

.chartTypePickerOutline__searchInput::placeholder {
  color: #98a2b3;
}

.chartTypePickerOutline__rail {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.chartTypePickerOutline__group {
  appearance: none;
  min-height: 84px;
  padding: 10px 12px 12px;
  border-radius: 18px;
  border: 1px solid var(--ctp-line);
  background: linear-gradient(180deg, #fafafb, #f7f8fa);
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
}

.chartTypePickerOutline__group:hover {
  transform: translateY(-1px);
  border-color: var(--ctp-line-strong);
  box-shadow: 0 8px 18px rgba(16, 24, 40, 0.05);
}

.chartTypePickerOutline__group--active {
  background: #ffffff;
  border-color: var(--ctp-line-strong);
  box-shadow: 0 10px 22px rgba(16, 24, 40, 0.07);
}

.chartTypePickerOutline__groupLabel {
  display: block;
  margin-bottom: 12px;
  color: #98a2b3;
  font-size: 10px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.chartTypePickerOutline__groupIcons {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ctp-muted);
}

.chartTypePickerOutline__group--active .chartTypePickerOutline__groupIcons {
  color: var(--ctp-ink);
}

.chartTypePickerOutline__body {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.85fr);
  gap: 16px;
}

.chartTypePickerOutline__library,
.chartTypePickerOutline__preview {
  border: 1px solid var(--ctp-line);
  border-radius: 22px;
  background: #ffffff;
  overflow: hidden;
}

.chartTypePickerOutline__libraryHead,
.chartTypePickerOutline__previewHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--ctp-line);
  background: linear-gradient(180deg, #fafafb, #ffffff);
}

.chartTypePickerOutline__libraryTitle,
.chartTypePickerOutline__previewTitle {
  margin: 0;
  color: var(--ctp-ink-strong);
  font-size: 15px;
  font-weight: 700;
}

.chartTypePickerOutline__libraryMeta,
.chartTypePickerOutline__previewMeta {
  margin: 0;
  color: var(--ctp-muted);
  font-size: 13px;
}

.chartTypePickerOutline__libraryScroll {
  padding: 18px;
}

.chartTypePickerOutline__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.chartTypePickerOutline__item {
  appearance: none;
  min-height: 108px;
  padding: 14px 10px 12px;
  border-radius: 18px;
  border: 1px solid var(--ctp-line);
  background: linear-gradient(180deg, #ffffff, #fbfbfc);
  color: var(--ctp-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  cursor: pointer;
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease, color 140ms ease, background 140ms ease;
}

.chartTypePickerOutline__item:hover {
  transform: translateY(-1px);
  border-color: var(--ctp-line-strong);
  box-shadow: 0 10px 18px rgba(16, 24, 40, 0.05);
  color: var(--ctp-ink);
}

.chartTypePickerOutline__item--selected {
  color: var(--ctp-ink-strong);
  border-color: #98a2b3;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  box-shadow: 0 12px 22px rgba(16, 24, 40, 0.07);
}

.chartTypePickerOutline__label {
  margin: 0;
  max-width: 108px;
  font-size: 13px;
  line-height: 1.18;
  font-weight: 600;
}

.chartTypePickerOutline__empty {
  min-height: 240px;
  display: grid;
  place-items: center;
  padding: 24px;
  text-align: center;
  color: var(--ctp-muted);
}

.chartTypePickerOutline__previewBody {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chartTypePickerOutline__hero {
  display: flex;
  align-items: center;
  gap: 16px;
}

.chartTypePickerOutline__heroBadge {
  width: 84px;
  height: 84px;
  border-radius: 22px;
  border: 1px solid var(--ctp-line);
  background: linear-gradient(180deg, #fafafb, #ffffff);
  display: grid;
  place-items: center;
  color: var(--ctp-ink);
}

.chartTypePickerOutline__heroText h3 {
  margin: 0 0 4px;
  color: var(--ctp-ink-strong);
  font-size: 24px;
  line-height: 1.04;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.chartTypePickerOutline__heroText p {
  margin: 0;
  color: var(--ctp-muted);
  font-size: 14px;
}

.chartTypePickerOutline__previewCanvas {
  min-height: 260px;
  border-radius: 22px;
  border: 1px dashed var(--ctp-line-strong);
  background:
    radial-gradient(circle at 1px 1px, rgba(152,162,179,0.4) 1px, transparent 0) 0 0 / 20px 20px,
    linear-gradient(180deg, #fafafb, #ffffff);
  display: grid;
  place-items: center;
  color: var(--ctp-ink);
}

.chartTypePickerOutline__previewHint {
  margin: 14px 0 0;
  color: var(--ctp-muted);
  font-size: 13px;
  text-align: center;
}

.chartTypePickerOutline__notes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.chartTypePickerOutline__note {
  min-height: 88px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--ctp-line);
  background: linear-gradient(180deg, #ffffff, #fbfbfc);
}

.chartTypePickerOutline__note h4 {
  margin: 0 0 6px;
  color: var(--ctp-ink-strong);
  font-size: 13px;
  font-weight: 700;
}

.chartTypePickerOutline__note p {
  margin: 0;
  color: var(--ctp-muted);
  font-size: 12.5px;
  line-height: 1.35;
}

@media (max-width: 1240px) {
  .chartTypePickerOutline__rail {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .chartTypePickerOutline__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 880px) {
  .chartTypePickerOutline__header {
    flex-direction: column;
    align-items: stretch;
  }

  .chartTypePickerOutline__search {
    min-width: 0;
    max-width: none;
  }

  .chartTypePickerOutline__rail {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chartTypePickerOutline__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chartTypePickerOutline__notes {
    grid-template-columns: 1fr;
  }
}
`;

function SearchGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export interface ChartTypePickerOutlineProps {
  value?: ChartIconName;
  defaultValue?: ChartIconName;
  onChange?: (value: ChartIconName) => void;
  chartName?: string;
}

function getGroupForIcon(name: ChartIconName): GroupKey {
  return itemLookup[name].groupKey;
}

export function ChartTypePickerOutline({
  value,
  defaultValue = "ChartTemporal",
  onChange,
  chartName = "Chart type system",
}: ChartTypePickerOutlineProps) {
  const [internalValue, setInternalValue] = React.useState<ChartIconName>(defaultValue);
  const [query, setQuery] = React.useState("");
  const [activeGroup, setActiveGroup] = React.useState<GroupKey>(getGroupForIcon(defaultValue));

  const currentValue = value ?? internalValue;
  const currentItem = itemLookup[currentValue];
  const PreviewIcon = currentItem.icon;
  const normalizedQuery = query.trim().toLowerCase();

  React.useEffect(() => {
    setActiveGroup(getGroupForIcon(currentValue));
  }, [currentValue]);

  const sections = normalizedQuery
    ? groupOrder
        .map((groupKey) => {
          const items = chartIconGroups[groupKey].filter((item) => {
            const text = `${item.label} ${item.name}`.toLowerCase();
            return text.includes(normalizedQuery);
          });
          return { groupKey, items };
        })
        .filter((section) => section.items.length > 0)
    : [{ groupKey: activeGroup, items: chartIconGroups[activeGroup] }];

  const visibleCount = sections.reduce((sum, section) => sum + section.items.length, 0);

  const handleSelect = (nextValue: ChartIconName) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    setActiveGroup(getGroupForIcon(nextValue));
    onChange?.(nextValue);
  };

  return (
    <section className="chartTypePickerOutline">
      <style>{styles}</style>

      <header className="chartTypePickerOutline__header">
        <div className="chartTypePickerOutline__titleWrap">
          <div className="chartTypePickerOutline__titleIcon" aria-hidden="true">
            <ChartColumns size={22} />
          </div>

          <div>
            <p className="chartTypePickerOutline__eyebrow">Outline system</p>
            <h2 className="chartTypePickerOutline__title">{chartName}</h2>
            <p className="chartTypePickerOutline__meta">
              Monochrome, lighter stroke language, closer to the Lucid-style shell you shared.
            </p>
          </div>
        </div>

        <label className="chartTypePickerOutline__search">
          <SearchGlyph />
          <input
            className="chartTypePickerOutline__searchInput"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chart types"
            aria-label="Search chart types"
          />
        </label>
      </header>

      <nav className="chartTypePickerOutline__rail" aria-label="Chart families">
        {groupOrder.map((groupKey) => {
          const [LeftIconName, RightIconName] = groupRepresentatives[groupKey];
          const LeftIcon = chartIconRegistry[LeftIconName];
          const RightIcon = chartIconRegistry[RightIconName];
          const active = groupKey === activeGroup && !normalizedQuery;

          return (
            <button
              key={groupKey}
              type="button"
              className={`chartTypePickerOutline__group ${active ? "chartTypePickerOutline__group--active" : ""}`}
              onClick={() => setActiveGroup(groupKey)}
            >
              <span className="chartTypePickerOutline__groupLabel">{groupLabels[groupKey]}</span>
              <span className="chartTypePickerOutline__groupIcons">
                <LeftIcon size={18} />
                <RightIcon size={18} />
              </span>
            </button>
          );
        })}
      </nav>

      <div className="chartTypePickerOutline__body">
        <section className="chartTypePickerOutline__library">
          <div className="chartTypePickerOutline__libraryHead">
            <div>
              <p className="chartTypePickerOutline__libraryTitle">
                {normalizedQuery ? "Search results" : groupLabels[activeGroup]}
              </p>
              <p className="chartTypePickerOutline__libraryMeta">
                {visibleCount} chart type{visibleCount === 1 ? "" : "s"}
              </p>
            </div>

            <p className="chartTypePickerOutline__libraryMeta">24×24 outline grid</p>
          </div>

          <div className="chartTypePickerOutline__libraryScroll">
            {visibleCount === 0 ? (
              <div className="chartTypePickerOutline__empty">
                <div>
                  <strong>No matches</strong>
                  <div>Try a broader keyword.</div>
                </div>
              </div>
            ) : (
              sections.map((section) => (
                <React.Fragment key={section.groupKey}>
                  {normalizedQuery ? (
                    <p className="chartTypePickerOutline__eyebrow" style={{ marginBottom: 12 }}>
                      {groupLabels[section.groupKey]}
                    </p>
                  ) : null}

                  <div className="chartTypePickerOutline__grid" style={{ marginBottom: normalizedQuery ? 16 : 0 }}>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const selected = item.name === currentValue;

                      return (
                        <button
                          key={item.name}
                          type="button"
                          className={`chartTypePickerOutline__item ${selected ? "chartTypePickerOutline__item--selected" : ""}`}
                          onClick={() => handleSelect(item.name)}
                          aria-pressed={selected}
                        >
                          <Icon size={selected ? 34 : 32} />
                          <p className="chartTypePickerOutline__label">{item.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </React.Fragment>
              ))
            )}
          </div>
        </section>

        <aside className="chartTypePickerOutline__preview">
          <div className="chartTypePickerOutline__previewHead">
            <div>
              <p className="chartTypePickerOutline__previewTitle">Selected chart</p>
              <p className="chartTypePickerOutline__previewMeta">
                {groupLabels[currentItem.groupKey].toLowerCase()} · 1 color only
              </p>
            </div>

            <p className="chartTypePickerOutline__previewMeta">Stroke-led</p>
          </div>

          <div className="chartTypePickerOutline__previewBody">
            <div className="chartTypePickerOutline__hero">
              <div className="chartTypePickerOutline__heroBadge">
                <PreviewIcon size={42} />
              </div>

              <div className="chartTypePickerOutline__heroText">
                <h3>{currentItem.label}</h3>
                <p>Reduced fill, quieter contrast, cleaner outline semantics.</p>
              </div>
            </div>

            <div className="chartTypePickerOutline__previewCanvas">
              <div>
                <PreviewIcon size={112} />
                <p className="chartTypePickerOutline__previewHint">
                  Inspired by the monochrome Lucid icon language, without copying the UI literally.
                </p>
              </div>
            </div>

            <div className="chartTypePickerOutline__notes">
              <div className="chartTypePickerOutline__note">
                <h4>No category colors</h4>
                <p>Everything runs in one neutral tone so the system feels calmer and more product-like.</p>
              </div>

              <div className="chartTypePickerOutline__note">
                <h4>More Lucide-friendly</h4>
                <p>Outline-first shapes, rounded joins, and much less filled mass than the previous set.</p>
              </div>

              <div className="chartTypePickerOutline__note">
                <h4>Safer direction</h4>
                <p>It keeps the chart semantics, but it does not mimic the original tiles as mini screenshots.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ChartTypePickerOutline;
