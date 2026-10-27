"use client";

import { MoreOutlined, UploadOutlined } from "@ant-design/icons";
import { Alert, Button, Dropdown, Modal, Upload, message, type UploadFile } from "antd";
import { useState } from "react";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function OrderProductImageActions({
  productNumber,
  disabled,
  onReplace,
}: {
  productNumber: number;
  disabled: boolean;
  onReplace: (image: File) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [messageApi, messageContextHolder] = message.useMessage();

  const replaceImage = async (): Promise<void> => {
    const file = files[0]?.originFileObj;
    if (!file || uploading || disabled) return;
    setUploading(true);
    setError(undefined);
    try {
      await onReplace(file);
      setOpen(false);
      setFiles([]);
      messageApi.success("Product image replaced.");
    } catch (replaceError) {
      setError(replaceError instanceof Error ? replaceError.message : "Failed to replace image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {messageContextHolder}
      <Dropdown
        disabled={disabled || uploading}
        trigger={["click"]}
        menu={{
          items: [{ key: "replace", label: "Upload New image", icon: <UploadOutlined /> }],
          onClick: () => {
            setError(undefined);
            setOpen(true);
          },
        }}
      >
        <Button
          aria-label={`More options for product ${productNumber}`}
          title="More options"
          icon={<MoreOutlined />}
          disabled={disabled || uploading}
          loading={uploading}
          size="small"
          style={{ width: 28, height: 28, borderRadius: 6, color: "#000", background: "#fff" }}
        />
      </Dropdown>
      <Modal
        title={`Replace product ${productNumber} image`}
        open={open}
        okText="Replace image"
        confirmLoading={uploading}
        okButtonProps={{ disabled: files.length === 0 || disabled }}
        cancelButtonProps={{ disabled: uploading }}
        closable={!uploading}
        mask={{ closable: !uploading }}
        keyboard={!uploading}
        onOk={() => void replaceImage()}
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
          aria-label={`Select replacement image for product ${productNumber}`}
          maxCount={1}
          fileList={files}
          listType="picture"
          disabled={uploading || disabled}
          beforeUpload={(file) => {
            if (
              !ALLOWED_IMAGE_TYPES.has(file.type) ||
              file.size === 0 ||
              file.size > MAX_IMAGE_SIZE_BYTES
            ) {
              setError("Select a JPEG, PNG, or WebP image up to 10 MB.");
              return Upload.LIST_IGNORE;
            }
            setError(undefined);
            return false;
          }}
          onChange={({ fileList }) => setFiles(fileList)}
        >
          <p className="ant-upload-text">Click or drag a replacement image here</p>
          <p className="ant-upload-hint">JPEG, PNG, or WebP, up to 10 MB.</p>
        </Upload.Dragger>
      </Modal>
    </>
  );
}
