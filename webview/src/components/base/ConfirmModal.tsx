import React from 'react';
import useModalRef, { type ModalRef } from 'use-modal-ref';
import { Modal } from './Modal';
import { Button } from './Button';

export type ConfirmModalData = {
  /** 标题。 */
  title: React.ReactNode;
  /** 提示内容。 */
  content: React.ReactNode;
  /** 取消按钮文本。 */
  cancelText: string;
  /** 确认按钮文本。 */
  okText: string;
  /** 确认按钮是否危险态（如删除）。 */
  danger?: boolean;
};

export type ConfirmModalResult = boolean;

export type ConfirmModalRef = ModalRef<'modal', ConfirmModalData, ConfirmModalResult>;

/**
 * 通用二次确认弹窗：用于替换 window.confirm，统一交互与样式（配合 use-modal-ref / showRefModal）。
 *
 * @param ref modal ref。
 * @returns React 元素或 null。
 */
export const ConfirmModal = React.forwardRef<ConfirmModalRef>(function ConfirmModal(_props, ref): React.ReactElement | null {
  const { modal, data } = useModalRef<ConfirmModalData, ConfirmModalResult>(
    ref,
    {
      title: '',
      content: '',
      cancelText: '取消',
      okText: '确定',
      danger: true,
    }
  );

  const onCancel = () => void modal.cancelModal();
  const onOk = () => void modal.endModal(true);

  return (
    <Modal
      open={modal.visible}
      title={data.title}
      onCancel={onCancel}
      width={420}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button type="default" onClick={onCancel}>
            {data.cancelText}
          </Button>
          <Button type="primary" onClick={onOk}>
            {data.okText}
          </Button>
        </div>
      }
    >
      <div style={{ whiteSpace: 'pre-wrap' }}>{data.content}</div>
    </Modal>
  );
});

