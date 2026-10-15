-- Phones that asked for new-order notifications (Kedai). One row per phone's push subscription.
CREATE TABLE push_subscriptions (
  endpoint    TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES shops (id),
  user_id     TEXT NOT NULL REFERENCES users (id),
  created_at  TEXT NOT NULL
);
CREATE INDEX push_subscriptions_shop ON push_subscriptions (shop_id);
