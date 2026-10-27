"use client";

import { CheckCircleFilled, ClockCircleFilled, ExclamationCircleFilled } from "@ant-design/icons";
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
    matched: { label: "Matched", color: "#16a34a", tagColor: "success", Icon: CheckCircleFilled },
    partial: { label: "Partial", color: "#f59e0b", tagColor: "warning", Icon: ClockCircleFilled },
    exceeds: { label: "Exceeds", color: "#ef2222", tagColor: "error", Icon: ExclamationCircleFilled },
  }[state];
  const Icon = appearance.Icon;

  return (
    <div className={styles.panel} data-state={state} role="status">
      <div className={styles.summary}>
        <Icon className={styles.icon} style={{ color: appearance.color }} />
        <div className={styles.counts}>
          <strong>{deliveredQuantity} / {quoteQuantity}</strong>
          <span>Delivered / Quote</span>
        </div>
        <Tag className={styles.status} color={appearance.tagColor}>{appearance.label}</Tag>
      </div>
      <div className={styles.progress}>
        <Progress
          percent={Math.min(percentage, 100)}
          showInfo={false}
          strokeColor={appearance.color}
          railColor="rgba(0, 0, 0, 0.06)"
          size="small"
          aria-label={`${appearance.label}: delivered ${deliveredQuantity} of ${quoteQuantity} quoted pieces`}
        />
        <strong>{percentage}%</strong>
      </div>
    </div>
  );
}
