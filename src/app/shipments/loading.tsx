import { Card, Skeleton } from "antd";
import styles from "./shipments.module.css";

export default function ShipmentsLoading() {
  return (
    <div
      className={styles.loadingPage}
      aria-label="Loading shipments"
      aria-busy="true"
    >
      <main className={styles.loadingMain}>
        <Skeleton
          active
          paragraph={{ rows: 1, width: 360 }}
          title={{ width: 190 }}
        />
        <Card className={styles.loadingTable}>
          <Skeleton active paragraph={{ rows: 7 }} />
        </Card>
      </main>
    </div>
  );
}
