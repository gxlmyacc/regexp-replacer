import React, { useCallback, useMemo, useState } from 'react';
import useModalRef, { type ModalRef } from 'use-modal-ref';
import { Button, Input, Modal } from './base';
import './RenameCommandModal.scss';

export type RenameCommandModalData = {
  title: string;
  initialValue: string;
  placeholder: string;
  cancelText: string;
  okText: string;
  validateName: (value: string) => string | undefined;
};

export type RenameCommandModalResult = string;

export type RenameCommandModalRef = ModalRef<'modal', RenameCommandModalData, RenameCommandModalResult>;

/**
 * 重命名命令弹层：用于 showRefModal 打开，内部基于 use-modal-ref 管理显隐与返回值。
 *
 * @param _props 无入参。
 * @returns React 元素。
 */
export const RenameCommandModal = React.forwardRef<RenameCommandModalRef>(function RenameCommandModal(_props, ref): React.ReactElement | null {
  const [value, setValue] = useState('');
  const [errorText, setErrorText] = useState<string | undefined>(undefined);

  const { modal, data } = useModalRef<RenameCommandModalData, RenameCommandModalResult>(
    ref,
    {
      title: '',
      initialValue: '',
      placeholder: '',
      cancelText: '取消',
      okText: '确定',
      validateName: () => undefined,
    },
    {
      beforeModal(nextData) {
        setValue(nextData.initialValue ?? '');
        setErrorText(undefined);
        return nextData;
      },
      afterModalClose() {
        setValue('');
        setErrorText(undefined);
      },
    },
  );

  const validateName = useMemo(() => data.validateName ?? (() => undefined), [data.validateName]);

  const onCancel = useCallback(() => {
    void modal.cancelModal();
  }, [modal]);

  const onOk = useCallback(() => {
    const v = value.trim();
    const err = validateName(v);
    setErrorText(err);
    if (err) return;
    void modal.endModal(v);
  }, [modal, validateName, value]);

  const showErr = errorText;

  return (
    <Modal
      open={modal.visible}
      title={data.title}
      onCancel={onCancel}
      footer={
        <div className="renameCommandModal__actions">
          <Button type="default" onClick={onCancel}>
            {data.cancelText}
          </Button>
          <Button type="primary" onClick={onOk}>
            {data.okText}
          </Button>
        </div>
      }
    >
      <Input
        variant="search"
        value={value}
        placeholder={data.placeholder}
        onChange={(e) => {
          // 仅在点击“确定”时做校验；这里的输入变化只负责清除历史错误提示。
          if (errorText) setErrorText(undefined);
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOk();
        }}
        autoFocus
        status={showErr ? 'error' : undefined}
        aria-label={data.placeholder}
      />
      {showErr ? <div className="renameCommandModal__error">{showErr}</div> : null}
    </Modal>
  );
});
