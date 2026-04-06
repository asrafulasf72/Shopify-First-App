import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";

// ── LOADER ──────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Run all queries in parallel for speed
  const [productsRes, ordersRes, countsRes] = await Promise.all([
    // Recent 5 products
    admin.graphql(`#graphql
      query {
        products(first: 5, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              status
              totalInventory
              featuredImage { url }
              variants(first: 1) {
                edges { node { price } }
              }
            }
          }
        }
      }
    `),
    // Recent 5 orders
    admin.graphql(`#graphql
      query {
        orders(first: 5, sortKey: PROCESSED_AT, reverse: true) {
          edges {
            node {
              id
              name
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet {
                shopMoney { amount currencyCode }
              }
              createdAt
              customer { firstName lastName }
            }
          }
        }
      }
    `),
    // Store-wide counts
    admin.graphql(`#graphql
      query {
        totalProducts: productsCount { count }
        activeProducts: productsCount(query: "status:ACTIVE") { count }
        outOfStock: productsCount(query: "inventory_total:0") { count }
        lowStock: productsCount(query: "inventory_total:<3") { count }
        totalOrders: ordersCount { count }
      }
    `),
  ]);

  const [pData, oData, cData] = await Promise.all([
    productsRes.json(),
    ordersRes.json(),
    countsRes.json(),
  ]);

  const recentProducts = pData.data.products.edges.map((e) => ({
    ...e.node,
    price: parseFloat(e.node.variants.edges[0]?.node.price || 0),
  }));

  const recentOrders = oData.data.orders.edges.map((e) => ({
    ...e.node,
    amount: parseFloat(e.node.totalPriceSet.shopMoney.amount),
    currency: e.node.totalPriceSet.shopMoney.currencyCode,
    customerName: e.node.customer
      ? `${e.node.customer.firstName || ""} ${e.node.customer.lastName || ""}`.trim()
      : "Guest",
    daysAgo: Math.floor((Date.now() - new Date(e.node.createdAt)) / (1000 * 60 * 60 * 24)),
  }));

  const counts = {
    totalProducts: cData.data.totalProducts?.count ?? 0,
    activeProducts: cData.data.activeProducts?.count ?? 0,
    outOfStock: cData.data.outOfStock?.count ?? 0,
    lowStock: cData.data.lowStock?.count ?? 0,
    totalOrders: cData.data.totalOrders?.count ?? 0,
  };

  return { recentProducts, recentOrders, counts };
};

// ── Status badge ─────────────────────────────────────────────────────
function StatusBadge({ status, type = "product" }) {
  const map = {
    ACTIVE:     { bg: "#d1fae5", color: "#065f46", label: "Active" },
    DRAFT:      { bg: "#f3f4f6", color: "#6b7280", label: "Draft" },
    ARCHIVED:   { bg: "#fef3c7", color: "#92400e", label: "Archived" },
    PAID:       { bg: "#d1fae5", color: "#065f46", label: "Paid" },
    PENDING:    { bg: "#fef3c7", color: "#92400e", label: "Pending" },
    REFUNDED:   { bg: "#fee2e2", color: "#991b1b", label: "Refunded" },
    FULFILLED:  { bg: "#d1fae5", color: "#065f46", label: "Fulfilled" },
    UNFULFILLED:{ bg: "#fff7ed", color: "#9a3412", label: "Unfulfilled" },
    PARTIAL:    { bg: "#fef3c7", color: "#92400e", label: "Partial" },
  };
  const s = map[status] || { bg: "#f3f4f6", color: "#6b7280", label: status };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "12px", fontSize: "11px",
      fontWeight: "600", background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────
export default function Dashboard() {
  const { recentProducts, recentOrders, counts } = useLoaderData();
  const navigate = useNavigate();

  const card = {
    background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: "12px", padding: "20px", marginBottom: "16px",
  };

  const statCards = [
    { label: "Total Products", value: counts.totalProducts, icon: "📦", color: "#6366f1", sub: `${counts.activeProducts} active`, onClick: () => navigate("/app/products") },
    { label: "Out of Stock", value: counts.outOfStock, icon: "⚠️", color: "#ef4444", sub: `${counts.lowStock} low stock`, onClick: () => navigate("/app/out-of-stock") },
    { label: "Total Orders", value: counts.totalOrders, icon: "🛒", color: "#10b981", sub: "All time", onClick: null },
    { label: "In Stock", value: counts.activeProducts - counts.outOfStock < 0 ? 0 : counts.totalProducts - counts.outOfStock, icon: "✅", color: "#0ea5e9", sub: "Available products", onClick: () => navigate("/app/products?status=ACTIVE") },
  ];

  return (
    <s-page heading="Dashboard">

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {statCards.map((s) => (
          <div
            key={s.label}
            onClick={s.onClick || undefined}
            style={{
              background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: "12px", padding: "20px",
              display: "flex", flexDirection: "column", gap: "10px",
              cursor: s.onClick ? "pointer" : "default",
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) => { if (s.onClick) e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151", marginTop: "4px" }}>{s.label}</div>
              </div>
              <div style={{
                width: "44px", height: "44px", borderRadius: "10px",
                background: s.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px",
              }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: "12px", color: "#9ca3af" }}>{s.sub}</div>
            {s.onClick && (
              <div style={{ fontSize: "12px", color: s.color, fontWeight: "500" }}>
                View all →
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Two column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Recent Products */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#111827" }}>🛍️ Recent Products</div>
            <button
              onClick={() => navigate("/app/products")}
              style={{ fontSize: "12px", color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: "500" }}
            >
              View all →
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {recentProducts.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px", color: "#9ca3af", fontSize: "13px" }}>No products yet</div>
            )}
            {recentProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/app/products/${p.id.split("/").pop()}`)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 8px", borderRadius: "8px", cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#f3f4f6", overflow: "hidden", flexShrink: 0 }}>
                  {p.featuredImage
                    ? <img src={p.featuredImage.url} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🛍️</div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                    ${p.price.toFixed(2)} · {p.totalInventory} in stock
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#111827" }}>🛒 Recent Orders</div>
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>Last 5 orders</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {recentOrders.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px", color: "#9ca3af", fontSize: "13px" }}>No orders yet</div>
            )}
            {recentOrders.map((o) => (
              <div key={o.id} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 8px", borderRadius: "8px",
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "8px",
                  background: "#f0fdf4", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "16px", flexShrink: 0,
                }}>🧾</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{o.name}</span>
                    <StatusBadge status={o.displayFinancialStatus} />
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                    {o.customerName} · {o.daysAgo === 0 ? "Today" : `${o.daysAgo}d ago`}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>
                    ${o.amount.toFixed(2)}
                  </div>
                  <StatusBadge status={o.displayFulfillmentStatus} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div style={{ ...card, marginTop: "0" }}>
        <div style={{ fontSize: "15px", fontWeight: "600", color: "#111827", marginBottom: "16px" }}>⚡ Quick Actions</div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {[
            { label: "View All Products", icon: "📦", color: "#6366f1", onClick: () => navigate("/app/products") },
            { label: "Out of Stock", icon: "⚠️", color: "#ef4444", onClick: () => navigate("/app/out-of-stock") },
            { label: "Active Products", icon: "✅", color: "#10b981", onClick: () => navigate("/app/products?status=ACTIVE") },
            { label: "Draft Products", icon: "📝", color: "#f59e0b", onClick: () => navigate("/app/products?status=DRAFT") },
          ].map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 16px", borderRadius: "8px",
                border: `1px solid ${action.color}30`,
                background: action.color + "0a",
                cursor: "pointer", fontSize: "13px",
                fontWeight: "500", color: action.color,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = action.color + "18")}
              onMouseLeave={(e) => (e.currentTarget.style.background = action.color + "0a")}
            >
              <span style={{ fontSize: "16px" }}>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Inventory alert ── */}
      {counts.outOfStock > 0 && (
        <div style={{
          background: "#fff5f5", border: "1px solid #fca5a5",
          borderRadius: "12px", padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px" }}>🚨</span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#991b1b" }}>
                {counts.outOfStock} product{counts.outOfStock > 1 ? "s" : ""} out of stock!
              </div>
              <div style={{ fontSize: "12px", color: "#b91c1c", marginTop: "2px" }}>
                Restock them to avoid losing sales.
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate("/app/out-of-stock")}
            style={{
              padding: "8px 16px", borderRadius: "8px",
              border: "none", background: "#ef4444",
              color: "#fff", fontSize: "13px",
              fontWeight: "500", cursor: "pointer",
            }}
          >
            View →
          </button>
        </div>
      )}

    </s-page>
  );
}