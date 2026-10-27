"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Modal, Upload, message, type UploadFile } from "antd";
import { useState } from "react";
import { uploadOrderImage } from "@/app/orders/api";
import type { OrderProductImage } from "@/services/orders";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function OrderProductImageUpload({
  orderId,
  onUploaded,
}: {
  orderId: string;
  onUploaded: (image: OrderProductImage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [messageApi, messageContextHolder] = message.useMessage();

  const uploadImages = async (): Promise<void> => {
    if (uploading || files.length === 0) return;
    setUploading(true);
    setError(undefined);
    try {
      // Save sequentially because the API allocates item IDs from Sheets rows.
      for (const file of files) {
        try {
          if (!file.originFileObj) throw new Error("Select the image again.");
          const response = await uploadOrderImage(
            orderId,
            file.originFileObj,
            "product",
          );
          if (response.imageType !== "product") {
            throw new Error("The image upload API returned an invalid image type.");
          }
          onUploaded(response.record);
          // Keep only unsaved files if a later upload fails.
          setFiles((current) => current.filter((item) => item.uid !== file.uid));
        } catch (uploadError) {
          setError(
            `${file.name}: ${uploadError instanceof Error ? uploadError.message : "Failed to upload image."}`,
          );
          return;
        }
      }
      setOpen(false);
      messageApi.success("Product images added.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {messageContextHolder}
      <Button
        icon={<PlusOutlined />}
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        Add product images
      </Button>
      <Modal
        title="Add product images"
        open={open}
        okText="Upload images"
        confirmLoading={uploading}
        okButtonProps={{ disabled: files.length === 0 }}
        cancelButtonProps={{ disabled: uploading }}
        closable={!uploading}
        maskClosable={!uploading}
        keyboard={!uploading}
        onOk={() => void uploadImages()}
        onCancel={() => {
          if (uploading) return;
          setOpen(false);
          setFiles([]);
          setError(undefined);
        }}
      >
        {error ? (
          <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
        ) : null}
        <Upload.Dragger
          accept="image/jpeg,image/png,image/webp"
          aria-label="Select product images"
          multiple
          listType="picture"
          fileList={files}
          disabled={uploading}
          beforeUpload={(file) => {
            if (
              !ALLOWED_IMAGE_TYPES.has(file.type) ||
              file.size === 0 ||
              file.size > MAX_IMAGE_SIZE_BYTES
            ) {
              setError(`${file.name}: Select a JPEG, PNG, or WebP image up to 10 MB.`);
              return Upload.LIST_IGNORE;
            }
            return false;
          }}
          onChange={({ fileList }) => setFiles(fileList)}
        >
          <p className="ant-upload-text">Click or drag product images here</p>
          <p className="ant-upload-hint">
            Select multiple images. JPEG, PNG, or WebP, up to 10 MB each.
          </p>
        </Upload.Dragger>
      </Modal>
    </>
  );
}
