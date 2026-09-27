import styles from "./salesDashboard.module.css";

export function MobileDateRange({
  range,
  onDateChange,
}: {
  range: [string, string];
  onDateChange: (position: "from" | "to", value: string) => void;
}) {
  return (
    <div
      aria-label="Dashboard date range"
      className={styles.nativeDateRange}
      role="group"
    >
      <label className={styles.nativeDateField}>
        <span>From</span>
        <input
          aria-label="Dashboard start date"
          className={styles.nativeDateInput}
          max={range[1]}
          required
          type="date"
          value={range[0]}
          onChange={(event) =>
            onDateChange("from", event.currentTarget.value)
          }
        />
      </label>
      <label className={styles.nativeDateField}>
        <span>To</span>
        <input
          aria-label="Dashboard end date"
          className={styles.nativeDateInput}
          min={range[0]}
          required
          type="date"
          value={range[1]}
          onChange={(event) => onDateChange("to", event.currentTarget.value)}
        />
      </label>
    </div>
  );
}
