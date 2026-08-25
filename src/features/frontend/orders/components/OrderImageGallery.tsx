"use client";
/* eslint-disable @next/next/no-img-element -- Native images preserve iOS long-press save behavior. */

import { Modal, Typography } from "antd";
import { type ReactNode, useState } from "react";
import styles from "./orders.module.css";

const { Text } = Typography;

export type OrderGalleryImage = {
  id: string;
  imageUrl: string;
  title: string;
  description?: string;
  details?: ReactNode;
};

export function OrderImageGallery({
  ariaLabel,
  images,
  showLabels = true,
  thumbnailSize = 96,
}: {
  ariaLabel: string;
  images: OrderGalleryImage[];
  showLabels?: boolean;
  thumbnailSize?: number;
}) {
  if (images.length === 0) {
    return null;
  }

  return (
    <section
      className={`${styles.productImages} ${
        showLabels ? "" : styles.productImagesCompact
      }`}
      aria-label={ariaLabel}
    >
      {images.map((image) => (
        <OrderImagePreview
          image={image}
          key={image.id}
          showLabels={showLabels}
          thumbnailSize={thumbnailSize}
        />
      ))}
    </section>
  );
}

function OrderImagePreview({
  image,
  showLabels,
  thumbnailSize,
}: {
  image: OrderGalleryImage;
  showLabels: boolean;
  thumbnailSize: number;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className={styles.productImage}>
      <button
        aria-label={`Preview ${image.title.toLowerCase()}`}
        className={styles.productImageTrigger}
        type="button"
        onClick={() => setPreviewOpen(true)}
      >
        <img
          alt={image.title}
          className={styles.productImageThumbnail}
          height={thumbnailSize}
          src={getGoogleDriveThumbnailUrl(image.imageUrl)}
          width={thumbnailSize}
        />
      </button>
      {showLabels ? <Text>{image.title}</Text> : null}
      {showLabels && image.description ? (
        <Text type="secondary">{image.description}</Text>
      ) : null}
      {showLabels && image.details ? image.details : null}

      <Modal
        centered
        className={styles.nativeImageModal}
        destroyOnHidden
        footer={null}
        open={previewOpen}
        title={image.title}
        width="min(980px, calc(100vw - 24px))"
        onCancel={() => setPreviewOpen(false)}
      >
        <div className={styles.nativeImagePreview}>
          <img
            alt={image.title}
            className={styles.nativeImage}
            src={getGoogleDrivePreviewUrl(image.imageUrl)}
          />
        </div>
      </Modal>
    </div>
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

function getGoogleDriveThumbnailUrl(imageUrl: string, size = "w1600"): string {
  const fileIdMatch = imageUrl.match(/\/file\/d\/([^/]+)/);
  if (fileIdMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(
      fileIdMatch[1],
    )}&sz=${size}`;
  }

  return imageUrl;
}
