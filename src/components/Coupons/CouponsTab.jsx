import { useCallback, useMemo } from "react";
import { Plus, RefreshCw, TicketPercent } from "lucide-react";
import { Button, Card, ConfirmDialog } from "../ui/index.js";
import { useDisclosure } from "../../hooks/ui/useDisclosure.js";
import {
  useCouponMutations,
  useCouponsQuery,
} from "../../hooks/coupons/useCoupons.js";
import { useCouponFilters } from "../../hooks/coupons/useCouponFilters.js";
import { describeCouponError } from "../../utils/coupons/couponErrors.js";
import { moneyCurrency } from "../../utils/coupons/couponModel.js";
import CouponsToolbar from "./CouponsToolbar.jsx";
import CouponList from "./CouponList.jsx";
import CouponFormModal from "./CouponFormModal.jsx";
import CouponDetailsModal from "./CouponDetailsModal.jsx";
import {
  CouponsEmptyState,
  CouponsErrorState,
  CouponsSkeleton,
} from "./CouponsStates.jsx";

const EMPTY = [];

/** Coupons tab: wires the coupon hooks to presentational parts. */
export default function CouponsTab({ embedded, showToast }) {
  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );

  const query = useCouponsQuery(getToken);
  const coupons = query.data || EMPTY;
  const filters = useCouponFilters(coupons);
  const { create, update, remove } = useCouponMutations(getToken);

  const formDialog = useDisclosure();
  const detailsDialog = useDisclosure();
  const deleteDialog = useDisclosure();

  const editing = formDialog.data;
  const activeMutation = editing ? update : create;
  const currency = useMemo(
    () => moneyCurrency(...coupons.map((c) => c.amount)),
    [coupons],
  );

  // Stable references keep the memoized cards from re-rendering.
  const { reset: resetCreate } = create;
  const { reset: resetUpdate } = update;
  const { reset: resetRemove } = remove;
  const { open: openFormDialog } = formDialog;
  const { open: openDeleteDialog } = deleteDialog;

  const openForm = useCallback(
    (coupon = null) => {
      resetCreate();
      resetUpdate();
      openFormDialog(coupon);
    },
    [resetCreate, resetUpdate, openFormDialog],
  );
  const openDelete = useCallback(
    (coupon) => {
      resetRemove();
      openDeleteDialog(coupon);
    },
    [resetRemove, openDeleteDialog],
  );

  const handleSubmit = (input) => {
    const onSuccess = () => {
      formDialog.close();
      showToast?.(
        editing
          ? `تم تعديل الكوبون ${input.code}`
          : `تم إنشاء الكوبون ${input.code}`,
        "success",
      );
    };
    if (editing) update.mutate({ id: editing.id, input }, { onSuccess });
    else create.mutate(input, { onSuccess });
  };

  const handleDelete = () => {
    const coupon = deleteDialog.data;
    remove.mutate(coupon.id, {
      onSuccess: () => {
        deleteDialog.close();
        showToast?.(`تم حذف الكوبون ${coupon.code}`, "success");
      },
    });
  };

  const formError = activeMutation.error
    ? describeCouponError(
        activeMutation.error.result,
        editing ? "update" : "create",
      )
    : null;
  const deleteError = remove.error
    ? describeCouponError(remove.error.result, "delete")
    : null;

  let content;
  if (query.isPending) {
    content = <CouponsSkeleton />;
  } else if (query.isError) {
    content = (
      <CouponsErrorState
        error={describeCouponError(query.error.result, "load")}
        onRetry={() => query.refetch()}
        onRefreshSession={() => embedded?.auth?.refresh?.()}
      />
    );
  } else if (!filters.visible.length) {
    content = (
      <CouponsEmptyState
        filtered={coupons.length > 0}
        onCreate={() => openForm(null)}
        onClearFilters={filters.clear}
      />
    );
  } else {
    content = (
      <CouponList
        items={filters.visible}
        onView={detailsDialog.open}
        onEdit={openForm}
        onDelete={openDelete}
      />
    );
  }

  return (
    <div className="coupons-container">
      <Card className="coupons-panel">
        <Card.Header
          icon={TicketPercent}
          title="الكوبونات"
          subtitle="أنشئ كوبونات خصم تنطبق على المتجر بالكامل وتابع حالتها."
          actions={
            <>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => openForm(null)}
              >
                إنشاء كوبون
              </Button>
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => query.refetch()}
                loading={query.isFetching && !query.isPending}
                disabled={query.isPending}
              >
                تحديث
              </Button>
            </>
          }
        />
        {coupons.length > 0 && (
          <CouponsToolbar filters={filters} disabled={query.isPending} />
        )}
        <div className="coupons-body">{content}</div>
      </Card>

      <CouponFormModal
        isOpen={formDialog.isOpen}
        coupon={editing}
        currency={currency}
        saving={activeMutation.isPending}
        serverError={formError}
        onClose={formDialog.close}
        onSubmit={handleSubmit}
        getToken={getToken}
      />

      <CouponDetailsModal
        isOpen={detailsDialog.isOpen}
        coupon={detailsDialog.data}
        status={
          detailsDialog.data && filters.statusById.get(detailsDialog.data.id)
        }
        onClose={detailsDialog.close}
      />

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        onConfirm={handleDelete}
        title="حذف الكوبون"
        subtitle={deleteDialog.data?.code}
        confirmText="حذف الكوبون"
        loading={remove.isPending}
        loadingText="جارٍ الحذف…"
      >
        <p>
          هل تريد حذف الكوبون{" "}
          <strong dir="ltr">{deleteDialog.data?.code}</strong> من متجرك في سلة؟
          لن يتمكن العملاء من استخدامه بعد الآن، ولا يمكن التراجع عن الحذف.
        </p>
        {deleteError && (
          <p className="coupon-delete-error" role="alert">
            {deleteError.title} {deleteError.reason}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
