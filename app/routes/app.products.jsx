import React from "react";
import { useLoaderData, useNavigate, useFetcher, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";

// ── LOADER ──────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const search = url.searchParams.get("search") || "";
  const statusFilter = url.searchParams.get("status") || "ALL";

  // Build GraphQL query string from filters
  let queryParts = [];
  if (search) queryParts.push(`title:*${search}*`);
  if (statusFilter !== "ALL") queryParts.push(`status:${statusFilter}`);
  const queryString = queryParts.join(" AND ");

  const response = await admin.graphql(
    `#graphql
    query getProducts($cursor: String, $query: String) {
      products(first: 10, after: $cursor, query: $query) {
        edges {
          node {
            id
            title
            status
            totalInventory
            featuredImage { url altText }
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  compareAtPrice
                  availableForSale
                  displayName
                }
              }
            }
          }
          cursor
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { variables: { cursor, query: queryString || null } }
  );

  const data = await response.json();
  // Store-wide counts
const countsResponse = await admin.graphql(`
  #graphql
  query getProductCounts {
    total: productsCount { count }
    active: productsCount(query: "status:ACTIVE") { count }
    draft: productsCount(query: "status:DRAFT") { count }
    lowStock: productsCount(query: "inventory_total:<3") { count }
  }
`);
const countsData = await countsResponse.json();
const storeCounts = {
  total: countsData.data.total?.count ?? 0,
  active: countsData.data.active?.count ?? 0,
  draft: countsData.data.draft?.count ?? 0,
  lowStock: countsData.data.lowStock?.count ?? 0,
};

  const products = data.data.products.edges.map((e) => {
    const variants = e.node.variants.edges.map((v) => v.node);
    const firstVariant = variants[0];
    const mainPrice = parseFloat(firstVariant?.price || 0);
    const comparePrice = firstVariant?.compareAtPrice
      ? parseFloat(firstVariant.compareAtPrice)
      : null;
    const discount =
      comparePrice && comparePrice > mainPrice
        ? Math.round(((comparePrice - mainPrice) / comparePrice) * 100)
        : null;
    const availableVariants = variants.filter((v) => v.availableForSale).length;
    return {
      ...e.node,
      cursor: e.cursor,
      mainPrice,
      comparePrice,
      discount,
      availableVariants,
      totalVariants: variants.length,
      variants,
    };
  });

  return {
    products,
    pageInfo: data.data.products.pageInfo,
    currentCursor: cursor,
    search,
    statusFilter,
    storeCounts,
  };
};

// ── ACTION ──────────────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const productId = formData.get("productId");
  const productTitle = formData.get("productTitle");

  if (intent === "delete") {
    await admin.graphql(
      `#graphql
      mutation deleteProduct($id: ID!) {
        productDelete(input: { id: $id }) {
          deletedProductId
          userErrors { field message }
        }
      }`,
      { variables: { id: productId } }
    );
    return { success: true, intent: "delete", title: productTitle };
  }

  if (intent === "duplicate") {
    const response = await admin.graphql(
      `#graphql
      mutation duplicateProduct($productId: ID!, $newTitle: String!) {
        productDuplicate(productId: $productId, newTitle: $newTitle, includeImages: true) {
          newProduct { id title }
          userErrors { field message }
        }
      }`,
      { variables: { productId, newTitle: `${productTitle} (Copy)` } }
    );
    const data = await response.json();
    const newProduct = data.data.productDuplicate.newProduct;
    return {
      success: true,
      intent: "duplicate",
      newProductId: newProduct?.id,
      title: productTitle,
    };
  }

  return { success: false };
};

// ── Skeleton row ─────────────────────────────────────────────────────
function SkeletonRow({ cols }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: cols,
      padding: "14px 16px", alignItems: "center",
      borderTop: "1px solid #f3f4f6",
    }}>
      {/* Image + title skeleton */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "#e5e7eb", flexShrink: 0, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: "12px", background: "#e5e7eb", borderRadius: "4px", width: "70%", marginBottom: "6px", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: "10px", background: "#f3f4f6", borderRadius: "4px", width: "40%", animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
      </div>
      {/* Other columns */}
      {[60, 70, 50, 80, 55, 30].map((w, i) => (
        <div key={i} style={{ height: "12px", background: "#e5e7eb", borderRadius: "4px", width: `${w}%`, animation: "pulse 1.5s ease-in-out infinite" }} />
      ))}
    </div>
  );
}

// ── Variant pill ──────────────────────────────────────────────────────
function VariantPill({ available, total }) {
  const pct = total > 0 ? (available / total) * 100 : 0;
  const barColor = available === total ? "#10b981" : available === 0 ? "#ef4444" : "#f59e0b";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <div style={{ width: "80px", height: "6px", borderRadius: "99px", background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "99px" }} />
      </div>
      <div style={{ fontSize: "11px", display: "flex", gap: "3px" }}>
        <span style={{ color: barColor, fontWeight: "600" }}>{available}/{total}</span>
        <span style={{ color: "#9ca3af" }}>{total - available > 0 ? `(${total - available} out)` : "✓ all ok"}</span>
      </div>
    </div>
  );
}

// ── Dropdown menu ─────────────────────────────────────────────────────
function DropdownMenu({ product, navigate, fetcher, rowIndex, totalRows }) {
  const [open, setOpen] = React.useState(false);
  const openUpward = rowIndex >= totalRows - 3;
  const shopify = useAppBridge();

  const handleDelete = () => {
    setOpen(false);
    if (confirm(`"${product.title}" will be permanently deleted. This cannot be undone.`)) {
      const fd = new FormData();
      fd.append("intent", "delete");
      fd.append("productId", product.id);
      fd.append("productTitle", product.title);
      fetcher.submit(fd, { method: "POST" });
    }
  };

  const handleDuplicate = () => {
    setOpen(false);
    const fd = new FormData();
    fd.append("intent", "duplicate");
    fd.append("productId", product.id);
    fd.append("productTitle", product.title);
    fetcher.submit(fd, { method: "POST" });
  };

  const actions = [
    {
      icon: "👁️",
      label: "Product Details",
      onClick: () => { setOpen(false); navigate(`/app/products/${product.id.split("/").pop()}`); },
    },
    {
      icon: "✏️",
      label: "Edit in Shopify",
      onClick: () => { setOpen(false); shopify.intents.invoke?.("edit:shopify/Product", { value: product.id }); },
    },
    {
      icon: "📋",
      label: "Duplicate",
      onClick: handleDuplicate,
    },
    { divider: true },
    {
      icon: "🗑️",
      label: "Delete",
      danger: true,
      onClick: handleDelete,
    },
  ];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{
          width: "30px", height: "30px", borderRadius: "6px",
          border: "1px solid #e5e7eb", background: open ? "#f3f4f6" : "#fff",
          cursor: "pointer", fontSize: "15px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: "700", color: "#6b7280", letterSpacing: "1px",
        }}
      >···</button>

      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div onClick={(e) => e.stopPropagation()} style={{
            position: "absolute", right: 0,
            ...(openUpward ? { bottom: "36px" } : { top: "36px" }),
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "10px", zIndex: 20, minWidth: "170px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden",
          }}>
            {actions.map((action, i) =>
              action.divider ? (
                <div key={i} style={{ height: "1px", background: "#f3f4f6", margin: "4px 0" }} />
              ) : (
                <button key={i} onClick={action.onClick} style={{
                  width: "100%", padding: "9px 14px",
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "none", border: "none",
                  cursor: "pointer", fontSize: "13px", fontWeight: "500",
                  color: action.danger ? "#dc2626" : "#374151", textAlign: "left",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = action.danger ? "#fff5f5" : "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: "15px" }}>{action.icon}</span>
                  {action.label}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function ProductsPage() {
  const { products, pageInfo, currentCursor, search, statusFilter, storeCounts } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigation = useNavigation(); // ← loading state detect করে
  const isLoading = navigation.state === "loading";

  const [searchInput, setSearchInput] = React.useState(search || "");
  const searchTimer = React.useRef(null);

  const COLS = "minmax(140px,2fr) 84px 96px 78px 108px 76px 50px";

  // Toast on action success
  React.useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.intent === "delete") shopify.toast.show(`"${fetcher.data.title}" deleted ✓`);
      if (fetcher.data.intent === "duplicate") shopify.toast.show(`"${fetcher.data.title}" duplicated ✓`);
    }
  }, [fetcher.data]);

  // Debounced search — 400ms পর URL update করে
  const handleSearch = (value) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (value) params.set("search", value);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      navigate(`/app/products?${params.toString()}`);
    }, 400);
  };

  const handleStatusFilter = (value) => {
    const params = new URLSearchParams();
    if (searchInput) params.set("search", searchInput);
    if (value !== "ALL") params.set("status", value);
    navigate(`/app/products?${params.toString()}`);
  };

  const loadNext = () => {
    const params = new URLSearchParams();
    const last = products[products.length - 1]?.cursor;
    params.set("cursor", last);
    if (searchInput) params.set("search", searchInput);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    navigate(`/app/products?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearchInput("");
    navigate("/app/products");
  };

  const hasFilters = search || statusFilter !== "ALL";

  return (
    <>
      {/* Pulse animation for skeleton */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <s-page heading="Products">

        {/* Stats */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          {[
  { label: "Total Products", value: storeCounts.total, color: "#6366f1", icon: "📦" },
  { label: "Active", value: storeCounts.active, color: "#10b981", icon: "✅" },
  { label: "Draft", value: storeCounts.draft, color: "#f59e0b", icon: "📝" },
  { label: "Low stock", value: storeCounts.lowStock, color: "#ef4444", icon: "⚠️" },
].map((stat) => (
            <div key={stat.label} style={{
              flex: 1, background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: "12px", padding: "16px 20px",
              display: "flex", alignItems: "center", gap: "14px",
              opacity: isLoading ? 0.6 : 1, transition: "opacity 0.2s",
            }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "10px",
                background: stat.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px",
              }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: "22px", fontWeight: "700", color: stat.color, lineHeight: 1.2 }}>{stat.value}</div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter bar */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
          {/* Search input */}
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{
              position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
              fontSize: "16px", pointerEvents: "none",
            }}>🔍</span>
            <input
              type="text"
              placeholder="Search products by title..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px 10px 38px",
                border: "1px solid #e5e7eb", borderRadius: "8px",
                fontSize: "13px", color: "#111827",
                outline: "none", boxSizing: "border-box",
                background: "#fff",
              }}
            />
            {isLoading && searchInput && (
              <span style={{
                position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                fontSize: "12px", color: "#6b7280",
              }}>Searching...</span>
            )}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter || "ALL"}
            onChange={(e) => handleStatusFilter(e.target.value)}
            style={{
              padding: "10px 14px", border: "1px solid #e5e7eb",
              borderRadius: "8px", fontSize: "13px", color: "#374151",
              background: "#fff", cursor: "pointer", outline: "none",
              minWidth: "130px",
            }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active only</option>
            <option value="DRAFT">Draft only</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* Clear filters button */}
          {hasFilters && (
            <button onClick={clearFilters} style={{
              padding: "10px 14px", border: "1px solid #e5e7eb",
              borderRadius: "8px", background: "#fff",
              fontSize: "13px", cursor: "pointer", color: "#6b7280",
              whiteSpace: "nowrap",
            }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* Active filter tags */}
        {hasFilters && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
            {search && (
              <span style={{
                padding: "4px 10px", background: "#ede9fe", color: "#6d28d9",
                borderRadius: "20px", fontSize: "12px", fontWeight: "500",
              }}>
                Search: "{search}"
              </span>
            )}
            {statusFilter !== "ALL" && (
              <span style={{
                padding: "4px 10px", background: "#d1fae5", color: "#065f46",
                borderRadius: "20px", fontSize: "12px", fontWeight: "500",
              }}>
                Status: {statusFilter}
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {["Product", "Price", "Compare", "Disc.", "Variants", "Status", ""].map((h) => (
              <span key={h} style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
            ))}
          </div>

          {/* Loading skeleton */}
          {isLoading && (
            <>
              {[...Array(5)].map((_, i) => (
                <SkeletonRow key={i} cols={COLS} />
              ))}
            </>
          )}

          {/* Empty state */}
          {!isLoading && products.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>
                {hasFilters ? "🔍" : "📦"}
              </div>
              <div style={{ fontSize: "16px", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
                {hasFilters ? "No products found" : "No products yet"}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
                {hasFilters ? "Try a different search or filter" : "Add products to your Shopify store"}
              </div>
              {hasFilters && (
                <button onClick={clearFilters} style={{
                  padding: "8px 16px", borderRadius: "8px",
                  border: "none", background: "#6366f1",
                  color: "#fff", fontSize: "13px", cursor: "pointer",
                }}>Clear filters</button>
              )}
            </div>
          )}

          {/* Product rows */}
          {!isLoading && products.map((product, index) => {
            const isActive = product.status === "ACTIVE";
            const isLowStock = product.totalInventory < 3;
            const isProcessing = fetcher.state !== "idle" && fetcher.formData?.get("productId") === product.id;

            return (
              <div
                key={product.id}
                onClick={() => navigate(`/app/products/${product.id.split("/").pop()}`)}
                style={{
                  display: "grid", gridTemplateColumns: COLS,
                  padding: "12px 16px", alignItems: "center",
                  borderTop: index === 0 ? "none" : "1px solid #f3f4f6",
                  cursor: "pointer", transition: "background 0.15s, opacity 0.2s",
                  background: isLowStock ? "#fff5f5" : "#fff",
                  opacity: isProcessing ? 0.4 : 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isLowStock ? "#ffe4e4" : "#f9fafb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = isLowStock ? "#fff5f5" : "#fff")}
              >
                {/* Product */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "#f3f4f6", overflow: "hidden", flexShrink: 0 }}>
                    {product.featuredImage
                      ? <img src={product.featuredImage.url} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>🛍️</div>
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: "500", fontSize: "13px", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isProcessing ? "⏳ " : ""}{product.title}
                    </div>
                    {isLowStock && <span style={{ fontSize: "10px", color: "#dc2626", fontWeight: "600" }}>⚠️ Low stock</span>}
                  </div>
                </div>

                {/* Price */}
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>${product.mainPrice.toFixed(2)}</span>

                {/* Compare */}
                <span>
                  {product.comparePrice
                    ? <s style={{ color: "#9ca3af", fontSize: "12px" }}>${product.comparePrice.toFixed(2)}</s>
                    : <span style={{ color: "#d1d5db" }}>—</span>}
                </span>

                {/* Discount */}
                <span>
                  {product.discount
                    ? <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 7px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>-{product.discount}%</span>
                    : <span style={{ color: "#d1d5db" }}>—</span>}
                </span>

                {/* Variants */}
                <VariantPill available={product.availableVariants} total={product.totalVariants} />

                {/* Status */}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  padding: "3px 8px", borderRadius: "20px",
                  fontSize: "11px", fontWeight: "500", width: "fit-content",
                  background: isActive ? "#d1fae5" : "#f3f4f6",
                  color: isActive ? "#065f46" : "#6b7280",
                }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: isActive ? "#10b981" : "#9ca3af", display: "inline-block" }} />
                  {isActive ? "Active" : "Draft"}
                </span>

                {/* Action */}
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu product={product} navigate={navigate} fetcher={fetcher} rowIndex={index} totalRows={products.length} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", padding: "0 4px" }}>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>
            {isLoading ? "Loading..." : `${products.length} products showing This Page ${hasFilters ? " (filtered)" : ""}`}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            {currentCursor && (
              <button onClick={() => navigate(-1)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", fontSize: "13px", fontWeight: "500", cursor: "pointer", color: "#374151" }}>← Previous</button>
            )}
            {pageInfo.hasNextPage ? (
              <button onClick={loadNext} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#6366f1", color: "#fff", fontSize: "13px", fontWeight: "500", cursor: "pointer" }}>Next →</button>
            ) : (
              !isLoading && <span style={{ fontSize: "13px", color: "#10b981", alignSelf: "center" }}>✓ All seen</span>
            )}
          </div>
        </div>

      </s-page>
    </>
  );
}