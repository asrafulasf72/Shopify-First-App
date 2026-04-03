import React from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const response = await admin.graphql(
    `#graphql
    query getOutOfStockProducts($cursor: String) {
      products(first: 10, after: $cursor, query: "inventory_total:0") {
        edges {
          node {
            id
            title
            status
            totalInventory
            updatedAt
            featuredImage {
              url
              altText
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  displayName
                  availableForSale
                  inventoryQuantity
                }
              }
            }
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`,
    { variables: { cursor } }
  );

  const data = await response.json();

  const products = data.data.products.edges.map((e) => {
    const variants = e.node.variants.edges.map((v) => v.node);
    const mainPrice = parseFloat(variants[0]?.price || 0);
    const totalVariants = variants.length;
    const outOfStockVariants = variants.filter((v) => !v.availableForSale).length;

    // কতদিন আগে update হয়েছে
    const updatedAt = new Date(e.node.updatedAt);
    const daysAgo = Math.floor((Date.now() - updatedAt) / (1000 * 60 * 60 * 24));

    return {
      ...e.node,
      cursor: e.cursor,
      mainPrice,
      variants,
      totalVariants,
      outOfStockVariants,
      daysAgo,
    };
  });

  const pageInfo = data.data.products.pageInfo;
  return { products, pageInfo, currentCursor: cursor };
};

// ── Urgency badge — কতদিন ধরে out of stock ──────────────────────────
function UrgencyBadge({ daysAgo }) {
  let bg, color, label;

  if (daysAgo <= 3) {
    bg = "#fef3c7"; color = "#92400e"; label = "🟡 New";
  } else if (daysAgo <= 14) {
    bg = "#ffedd5"; color = "#9a3412"; label = "🟠 " + daysAgo + "d ago";
  } else {
    bg = "#fee2e2"; color = "#991b1b"; label = "🔴 " + daysAgo + "d ago";
  }

  return (
    <span style={{
      background: bg, color,
      padding: "3px 9px", borderRadius: "12px",
      fontSize: "11px", fontWeight: "600",
    }}>
      {label}
    </span>
  );
}

// ── Variant breakdown ────────────────────────────────────────────────
function VariantBreakdown({ variants }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      {variants.slice(0, 3).map((v) => (
        <div key={v.id} style={{
          display: "flex", alignItems: "center", gap: "6px", fontSize: "11px",
        }}>
          <span style={{
            width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
            background: v.availableForSale ? "#10b981" : "#ef4444",
          }} />
          <span style={{
            color: v.availableForSale ? "#374151" : "#9ca3af",
            textDecoration: v.availableForSale ? "none" : "line-through",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            maxWidth: "120px",
          }}>
            {v.displayName?.split(" - ").pop() || "Default"}
          </span>
          <span style={{ color: "#9ca3af", marginLeft: "auto" }}>
            {v.inventoryQuantity ?? 0}
          </span>
        </div>
      ))}
      {variants.length > 3 && (
        <span style={{ fontSize: "10px", color: "#9ca3af" }}>
          +{variants.length - 3} more variants
        </span>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function OutOfStockPage() {
  const { products, pageInfo, currentCursor } = useLoaderData();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const loadNext = () => {
    const last = products[products.length - 1]?.cursor;
    navigate(`/app/products/out-of-stock?cursor=${last}`);
  };

  const critical = products.filter((p) => p.daysAgo > 14).length;
  const warning = products.filter((p) => p.daysAgo > 3 && p.daysAgo <= 14).length;
  const recent = products.filter((p) => p.daysAgo <= 3).length;

  return (
    <s-page heading="Out of Stock Products">

      {/* ── Alert banner ── */}
      {critical > 0 && (
        <div style={{
          background: "#fee2e2", border: "1px solid #fca5a5",
          borderRadius: "10px", padding: "14px 18px",
          display: "flex", alignItems: "center", gap: "12px",
          marginBottom: "20px",
        }}>
          <span style={{ fontSize: "20px" }}>🚨</span>
          <div>
            <div style={{ fontWeight: "600", color: "#991b1b", fontSize: "14px" }}>
              {critical}টা product ১৪ দিনেরও বেশি সময় ধরে out of stock!
            </div>
            <div style={{ fontSize: "12px", color: "#b91c1c", marginTop: "2px" }}>
              এগুলো restock করলে sales বাড়তে পারে।
            </div>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "মোট out of stock", value: products.length, color: "#ef4444", icon: "📦", bg: "#fee2e2" },
          { label: "Critical (14d+)", value: critical, color: "#dc2626", icon: "🔴", bg: "#fee2e2" },
          { label: "Warning (3-14d)", value: warning, color: "#ea580c", icon: "🟠", bg: "#ffedd5" },
          { label: "Recent (0-3d)", value: recent, color: "#d97706", icon: "🟡", bg: "#fef3c7" },
        ].map((stat) => (
          <div key={stat.label} style={{
            flex: 1, background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "12px", padding: "16px 20px",
            display: "flex", alignItems: "center", gap: "14px",
          }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: stat.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px",
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "700", color: stat.color, lineHeight: 1.2 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Empty state ── */}
      {products.length === 0 && (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          border: "1px solid #e5e7eb", borderRadius: "12px",
          background: "#f9fafb",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#111827" }}>
            সব product in stock আছে!
          </div>
          <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "8px" }}>
            কোনো out of stock product নেই।
          </div>
          <button
            onClick={() => navigate("/app/products")}
            style={{
              marginTop: "20px", padding: "10px 20px",
              borderRadius: "8px", border: "none",
              background: "#6366f1", color: "#fff",
              fontSize: "14px", fontWeight: "500", cursor: "pointer",
            }}
          >
            ← Products এ ফিরে যাও
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {products.length > 0 && (
        <div style={{ border: "1px solid #fca5a5", borderRadius: "10px", overflow: "hidden" }}>

          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px,2fr) 90px 140px 160px 100px",
            padding: "10px 16px",
            background: "#fff5f5", borderBottom: "1px solid #fca5a5",
          }}>
            {["Product", "Price", "Out of stock since", "Variants breakdown", "Action"].map((h) => (
              <span key={h} style={{
                fontSize: "11px", fontWeight: "600", color: "#991b1b",
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {products.map((product, index) => (
            <div
              key={product.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(160px,2fr) 90px 140px 160px 100px",
                padding: "14px 16px", alignItems: "center",
                borderTop: index === 0 ? "none" : "1px solid #fee2e2",
                background: product.daysAgo > 14 ? "#fff5f5" : "#fff",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = product.daysAgo > 14 ? "#fff5f5" : "#fff")
              }
            >
              {/* Product */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "8px",
                  background: "#fee2e2", overflow: "hidden", flexShrink: 0,
                  border: "1px solid #fca5a5",
                }}>
                  {product.featuredImage ? (
                    <img
                      src={product.featuredImage.url}
                      alt={product.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }}
                    />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%", display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: "16px",
                    }}>📦</div>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: "500", fontSize: "13px", color: "#111827",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {product.title}
                  </div>
                  <span style={{
                    fontSize: "10px", fontWeight: "600",
                    color: product.status === "ACTIVE" ? "#065f46" : "#6b7280",
                    background: product.status === "ACTIVE" ? "#d1fae5" : "#f3f4f6",
                    padding: "1px 6px", borderRadius: "8px",
                  }}>
                    {product.status}
                  </span>
                </div>
              </div>

              {/* Price */}
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
                ${product.mainPrice.toFixed(2)}
              </span>

              {/* Urgency */}
              <UrgencyBadge daysAgo={product.daysAgo} />

              {/* Variant breakdown */}
              <VariantBreakdown variants={product.variants} />

              {/* Actions */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => {
                    shopify.intents.invoke?.("edit:shopify/Product", {
                      value: product.id,
                    });
                  }}
                  style={{
                    padding: "6px 10px", borderRadius: "6px",
                    border: "1px solid #fca5a5", background: "#fff5f5",
                    cursor: "pointer", fontSize: "13px", fontWeight: "500",
                    color: "#dc2626",
                  }}
                >
                  🔄 Restock
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {products.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginTop: "20px", padding: "0 4px",
        }}>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>
            {products.length} products showing
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            {currentCursor && (
              <button
                onClick={() => navigate(-1)}
                style={{
                  padding: "8px 16px", borderRadius: "8px",
                  border: "1px solid #e5e7eb", background: "#fff",
                  fontSize: "13px", fontWeight: "500",
                  cursor: "pointer", color: "#374151",
                }}
              >
                ← Previous
              </button>
            )}
            {pageInfo.hasNextPage ? (
              <button
                onClick={loadNext}
                style={{
                  padding: "8px 16px", borderRadius: "8px",
                  border: "none", background: "#ef4444",
                  color: "#fff", fontSize: "13px",
                  fontWeight: "500", cursor: "pointer",
                }}
              >
                Next →
              </button>
            ) : (
              <span style={{ fontSize: "13px", color: "#10b981", alignSelf: "center" }}>
                ✓ All Seen
              </span>
            )}
          </div>
        </div>
      )}

    </s-page>
  );
}