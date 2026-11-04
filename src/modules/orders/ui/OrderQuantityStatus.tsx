"use client";

import { Progress, Tag } from "antd";
import styles from "./orderQuantityStatus.module.css";

export function OrderQuantityStatus({
  deliveredQuantity,
  quoteQuantity,
}: {
  deliveredQuantity: number | null;
  quoteQuantity: number | null;
}) {
  if (
    deliveredQuantity === null || quoteQuantity === null ||
    !Number.isInteger(deliveredQuantity) || !Number.isInteger(quoteQuantity) ||
    deliveredQuantity <= 0 || quoteQuantity <= 0
  ) return null;

  const state = deliveredQuantity === quoteQuantity ? "matched"
    : deliveredQuantity < quoteQuantity ? "partial" : "exceeds";
  const percentage = Math.round((deliveredQuantity / quoteQuantity) * 100);
  const appearance = {
    matched: { label: "Matched", color: "#16a34a", tagColor: "success" },
    partial: { label: "Short", color: "#ef2222", tagColor: "error" },
    exceeds: { label: "Extra", color: "#1677ff", tagColor: "blue" },
  }[state];

  return (
    <div className={styles.panel} data-state={state} role="status" title={`${percentage}% delivered`}>
      <strong className={styles.counts} title="Delivered / Quote">
        {deliveredQuantity} / {quoteQuantity}
      </strong>
      <Tag className={styles.status} color={appearance.tagColor}>{appearance.label}</Tag>
      <Progress
        className={styles.progress}
        percent={Math.min(percentage, 100)}
        showInfo={false}
        strokeColor={appearance.color}
        railColor="rgba(0, 0, 0, 0.06)"
        size="small"
        strokeWidth={4}
        aria-label={`${appearance.label}: delivered ${deliveredQuantity} of ${quoteQuantity} quoted pieces (${percentage}%)`}
      />
    </div>
  );
}
