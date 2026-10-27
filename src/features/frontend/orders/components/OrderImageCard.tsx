"use client";
/* eslint-disable @next/next/no-img-element -- Native images preserve iOS long-press save behavior. */

import { Card, Typography } from "antd";
import type { ReactNode } from "react";
import styles from "./orders.module.css";

export type OrderGalleryImage = {
  id: string;
  imageUrl: string;
  title: string;
  sequenceNumber?: number;
  description?: string;
  details?: ReactNode;
};

export function OrderImageCard({
  image,
  onPreview,
  showLabels,
  thumbnailSize,
  variant = "card",
}: {
  image: OrderGalleryImage;
  onPreview: () => void;
  showLabels: boolean;
  thumbnailSize: number;
  variant?: "plain" | "card";
}) {
  const content = (
    <div className={styles.productImage}>
      <button
        aria-label={`Preview ${image.title.toLowerCase()}`}
        className={styles.productImageTrigger}
        type="button"
        onClick={onPreview}
      >
        <img
          alt={image.title}
          className={styles.productImageThumbnail}
          height={thumbnailSize}
          src={getGoogleDriveThumbnailUrl(image.imageUrl)}
          width={thumbnailSize}
        />
        {image.sequenceNumber !== undefined ? (
          <span className={styles.productImageNumber}>
            {image.sequenceNumber}
          </span>
        ) : null}
      </button>
      {showLabels && image.sequenceNumber === undefined ? (
        <Typography.Text>{image.title}</Typography.Text>
      ) : null}
      {showLabels && image.description ? (
        <Typography.Text type="secondary">{image.description}</Typography.Text>
      ) : null}
      {showLabels && image.details ? image.details : null}
    </div>
  );

  return variant === "card" ? (
    <Card className={styles.productImageCard} size="small" styles={{ body: { padding: 12 } }}>
      {content}
    </Card>
  ) : content;
}

function getGoogleDriveThumbnailUrl(imageUrl: string, size = "w1600"): string {
  const fileIdMatch = imageUrl.match(/\/file\/d\/([^/]+)/);
  if (fileIdMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileIdMatch[1])}&sz=${size}`;
  }
  return imageUrl;
}
