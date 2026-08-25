import { Card, Col, Row, Skeleton } from "antd";
import styles from "../../features/frontend/orders/components/orders.module.css";

export default function OrdersLoading() {
  return (
    <div className={styles.loadingPage} aria-label="Loading orders" aria-busy="true">
      <main className={styles.loadingMain}>
        <Skeleton active paragraph={{ rows: 1, width: 360 }} title={{ width: 190 }} />
        <Row className={styles.loadingSummary} gutter={[12, 12]}>
          {Array.from({ length: 4 }, (_, index) => (
            <Col xs={12} lg={6} key={index}>
              <Card><Skeleton active paragraph={false} /></Card>
            </Col>
          ))}
        </Row>
        <Card className={styles.loadingTable}>
          <Skeleton active paragraph={{ rows: 7 }} />
        </Card>
      </main>
    </div>
  );
}
