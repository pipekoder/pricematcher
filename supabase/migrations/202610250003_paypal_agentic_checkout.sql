-- PR #5 adds an atomic claim state before the external create-order operation.
alter table checkout_attempts drop constraint checkout_attempts_status_check;
alter table checkout_attempts add constraint checkout_attempts_status_check check (
  status in ('prepared','order_pending','order_created','buyer_approved','capture_pending','captured','failed','reconciliation_required','reconciled')
);
