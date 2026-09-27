import { DatePicker } from "antd";
import dayjs from "dayjs";
import styles from "./salesDashboard.module.css";

const { RangePicker } = DatePicker;

export function DesktopDateRange({
  range,
  onChange,
}: {
  range: [string, string];
  onChange: (range: [string, string]) => void;
}) {
  return (
    <RangePicker
      allowClear={false}
      aria-label="Dashboard date range"
      className={styles.fullWidth}
      format="YYYY-MM-DD"
      value={[
        dayjs(range[0], "YYYY-MM-DD"),
        dayjs(range[1], "YYYY-MM-DD"),
      ]}
      onChange={(_, values) => onChange([values[0] || "", values[1] || ""])}
    />
  );
}
