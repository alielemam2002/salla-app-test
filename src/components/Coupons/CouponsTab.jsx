import { useCallback, useMemo } from "react";
import { Plus, RefreshCw, TicketPercent } from "lucide-react";
import { Button, Card, ConfirmDialog } from "../ui/index.js";
import { useDisclosure } from "../../hooks/ui/useDisclosure.js";
import {
  useCouponMutations,
  useCouponsQuery,
} from "../../hooks/coupons/useCoupons.js";
import { useCouponFilters } from "../../hooks/coupons/useCouponFilters.js";
import {
  useCouponBarMutations,
  useCouponBarQuery,
} from "../../hooks/coupons/useCouponBar.js";
import { describeCouponError } from "../../utils/coupons/couponErrors.js";
import { isBarFor } from "../../utils/coupons/couponBar.js";
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

/** Coupons & Promotions tab: wires the coupon hooks to presentational parts. */
export default function CouponsTab({ embedded, showToast }) {
  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );

  const query = useCouponsQuery(getToken);
  const coupons = query.data || EMPTY;
  const filters = useCouponFilters(coupons);
  const { create, update, remove } = useCouponMutations(getToken);
  const barQuery = useCouponBarQuery(getToken);
  const barMutations = useCouponBarMutations(getToken);
  const bar = barQuery.data ?? null;
  const barUnavailable = barQuery.isError
    ? describeCouponError(barQuery.error.result, "barLoad").reason
    : null;

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

  const barError = (error) => {
    const { title, reason } = describeCouponError(error.result, "bar");
    showToast?.(`${title} ${reason}`, "error");
  };

  // Runs after the coupon itself saved: show, update or hide its bar.
  const syncBar = (input, barInput, previousCode) => {
    if (barUnavailable) return;
    if (barInput) {
      barMutations.save.mutate(barInput, { onError: barError });
    } else if (isBarFor(bar, previousCode || input.code)) {
      barMutations.clear.mutate(previousCode || input.code, {
        onError: barError,
      });
    }
  };

  const handleSubmit = (input, barInput = null) => {
    const previousCode = editing?.code;
    const onSuccess = () => {
      formDialog.close();
      showToast?.(
        editing
          ? `Coupon ${input.code} updated`
          : `Coupon ${input.code} created`,
        "success",
      );
      syncBar(input, barInput, previousCode);
    };
    if (editing) update.mutate({ id: editing.id, input }, { onSuccess });
    else create.mutate(input, { onSuccess });
  };

  const handleDelete = () => {
    const coupon = deleteDialog.data;
    remove.mutate(coupon.id, {
      onSuccess: () => {
        deleteDialog.close();
        showToast?.(`Coupon ${coupon.code} deleted`, "success");
        if (isBarFor(bar, coupon.code)) {
          barMutations.clear.mutate(coupon.code, { onError: barError });
        }
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
        barCode={bar?.code}
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
          title="Coupons & Promotions"
          subtitle="Create and manage storewide discounts."
          actions={
            <>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => openForm(null)}
              >
                Create Coupon
              </Button>
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => query.refetch()}
                loading={query.isFetching && !query.isPending}
                disabled={query.isPending}
              >
                Refresh
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
        bar={bar}
        barUnavailable={barUnavailable}
        currency={currency}
        saving={activeMutation.isPending}
        serverError={formError}
        onClose={formDialog.close}
        onSubmit={handleSubmit}
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
        title="Delete coupon"
        subtitle={deleteDialog.data?.code}
        confirmText="Delete coupon"
        loading={remove.isPending}
        loadingText="Deleting…"
      >
        <p>
          Delete <strong>{deleteDialog.data?.code}</strong> from your Salla
          store? Customers won't be able to use it anymore. This can't be
          undone.
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
