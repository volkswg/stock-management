"use client";
/* eslint-disable @next/next/no-img-element -- Native images preserve iOS long-press save behavior. */

import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Modal, Typography } from "antd";
import { useEffect, useState } from "react";
import { OrderImageCard, type OrderGalleryImage } from "./OrderImageCard";
import styles from "./orders.module.css";

const { Text } = Typography;

export type { OrderGalleryImage } from "./OrderImageCard";

export function OrderImageGallery({
  ariaLabel,
  images,
  showLabels = true,
  thumbnailSize = 96,
  variant = "plain",
}: {
  ariaLabel: string;
  images: OrderGalleryImage[];
  showLabels?: boolean;
  thumbnailSize?: number;
  variant?: "plain" | "card";
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null || images.length < 2) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input, textarea, select, [contenteditable], [role='spinbutton'], [role='combobox']"))
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) =>
          current === null ? current : Math.max(0, current - 1),
        );
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) =>
          current === null ? current : Math.min(images.length - 1, current + 1),
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length]);

  if (images.length === 0) {
    return null;
  }

  const activeImage = activeIndex === null ? undefined : images[activeIndex];

  return (
    <>
      <section
        className={`${styles.productImages} ${
          showLabels ? "" : styles.productImagesCompact
        } ${variant === "card" ? styles.productImageGrid : ""}`}
        aria-label={ariaLabel}
      >
        {images.map((image, index) => (
          <OrderImageCard
            image={image}
            key={image.id}
            showLabels={showLabels}
            thumbnailSize={thumbnailSize}
            variant={variant}
            onPreview={() => setActiveIndex(index)}
          />
        ))}
      </section>

      <Modal
        centered
        className={styles.nativeImageModal}
        destroyOnHidden
        footer={activeImage?.details ? (
          <Button onClick={() => setActiveIndex(null)}>Done</Button>
        ) : null}
        open={Boolean(activeImage)}
        title={
          activeImage
            ? `${activeImage.title} (${(activeIndex ?? 0) + 1} of ${images.length})`
            : "Product image"
        }
        width="min(980px, calc(100vw - 24px))"
        onCancel={() => setActiveIndex(null)}
      >
        {activeImage ? (
          <div className={`${styles.nativeImagePreviewLayout} ${activeImage.details ? styles.nativeImagePreviewEditable : ""}`}>
            <div className={styles.nativeImagePreview}>
              <img
                alt={activeImage.title}
                className={styles.nativeImage}
                src={getGoogleDrivePreviewUrl(activeImage.imageUrl)}
              />
            </div>
            {activeImage.details ? (
              <div>
                {activeImage.details}
                <Text type="secondary">
                  Edits stay as drafts. Use Save in Product images to save them.
                </Text>
              </div>
            ) : null}
            {images.length > 1 ? (
              <div
                aria-label="Product image navigation"
                className={styles.nativeImageControls}
              >
                <Button
                  aria-label="Previous product image"
                  className={styles.nativeImageNavigationButton}
                  disabled={activeIndex === 0}
                  icon={<LeftOutlined />}
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === null ? current : Math.max(0, current - 1),
                    )
                  }
                >
                  Previous
                </Button>
                <Text type="secondary">
                  {(activeIndex ?? 0) + 1} / {images.length}
                </Text>
                <Button
                  aria-label="Next product image"
                  className={styles.nativeImageNavigationButton}
                  disabled={activeIndex === images.length - 1}
                  icon={<RightOutlined />}
                  iconPlacement="end"
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === null
                        ? current
                        : Math.min(images.length - 1, current + 1),
                    )
                  }
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function getGoogleDrivePreviewUrl(imageUrl: string): string {
  const fileIdMatch = imageUrl.match(/\/file\/d\/([^/]+)/);
  if (fileIdMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(
      fileIdMatch[1],
    )}?authuser=0`;
  }

  return imageUrl;
}
