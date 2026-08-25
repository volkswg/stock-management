import { Card, Skeleton } from "antd";
import styles from "./shipmentDetail.module.css";

export default function ShipmentDetailLoading() {
  return (
    <div className={styles.appShell}>
      <main
        aria-busy="true"
        aria-label="Loading shipment details"
        className={styles.content}
      >
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: 260 }} />
        <Card className={styles.informationCard}>
          <Skeleton active paragraph={{ rows: 5 }} title={false} />
        </Card>
        <Card className={styles.ordersCard}>
          <Skeleton active paragraph={{ rows: 4 }} title={{ width: 180 }} />
        </Card>
      </main>
    </div>
  );
}
