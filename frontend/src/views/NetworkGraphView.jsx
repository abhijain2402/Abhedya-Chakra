import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useInvestigation } from '../context/InvestigationContext';
import { traceAccountFunds, fetchAccountDetails, fetchGlobalNetworkGraph } from '../services/api';
import { Network as VisNetwork } from 'vis-network';
import { DataSet } from 'vis-data';
import {
  ZoomIn, ZoomOut, Maximize2, RefreshCw, X, Globe, GitCommit,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Info, AlertTriangle,
  Activity, Target, Layers, Eye, Circle, ArrowRight as ArrowR
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   HOP COLOR MAP  (0=root, 1–4 concentric rings)
═══════════════════════════════════════════════════════════════ */
const HOP_PALETTE = [
  { bg: '#dc2626', border: '#7f1d1d', glow: 'rgba(220,38,38,0.6)',  label: '🎯 Root'   },  // 0
  { bg: '#ea580c', border: '#7c2d12', glow: 'rgba(234,88,12,0.55)',  label: 'Hop 1'     },  // 1
  { bg: '#ca8a04', border: '#713f12', glow: 'rgba(202,138,4,0.5)',   label: 'Hop 2'     },  // 2
  { bg: '#16a34a', border: '#14532d', glow: 'rgba(22,163,74,0.5)',   label: 'Hop 3'     },  // 3
  { bg: '#0284c7', border: '#0c4a6e', glow: 'rgba(2,132,199,0.5)',   label: 'Hop 4'     },  // 4
];

/* ═══════════════════════════════════════════════════════════════
   BFS  — shortest connection path from root → target
   Returns array of {from, to, tx, hop} or null
═══════════════════════════════════════════════════════════════ */
function traceConnectionPath(traceData, rootId, targetId) {
  if (targetId === rootId) return [];

  // Build directed adjacency: sender → [{receiver, tx}]
  const adj = new Map();
  (traceData?.paths || []).forEach(path =>
    path.transactions.forEach(tx => {
      if (!adj.has(tx.sender_account)) adj.set(tx.sender_account, []);
      adj.get(tx.sender_account).push({ to: tx.receiver_account, tx });
    })
  );

  // BFS
  const queue   = [{ node: rootId, path: [] }];
  const visited = new Set([rootId]);
  while (queue.length > 0) {
    const { node, path } = queue.shift();
    for (const { to, tx } of (adj.get(node) || [])) {
      if (visited.has(to)) continue;
      const newPath = [...path, { from: node, to, tx }];
      if (to === targetId) return newPath;
      visited.add(to);
      queue.push({ node: to, path: newPath });
    }
  }
  return null; // not found in trace (indirect via reverse)
}

/* ═══════════════════════════════════════════════════════════════
   RADIAL POSITION for trace graph
   ROOT at (0,0), hop N nodes in ring of radius N×RING_R
═══════════════════════════════════════════════════════════════ */
const RING_R = 240;

function computeRadialPositions(nodesMap) {
  const hopGroups = new Map(); // hop → [nodeId]
  nodesMap.forEach((n, id) => {
    const h = n._hop || 0;
    if (!hopGroups.has(h)) hopGroups.set(h, []);
    hopGroups.get(h).push(id);
  });

  hopGroups.forEach((ids, hop) => {
    ids.forEach((id, idx) => {
      if (hop === 0) {
        nodesMap.get(id).x = 0;
        nodesMap.get(id).y = 0;
        nodesMap.get(id).fixed = { x: true, y: true };
      } else {
        const total  = ids.length;
        const offset = hop % 2 === 0 ? Math.PI / total : 0; // stagger alternate rings
        const angle  = offset + (idx / total) * 2 * Math.PI;
        const r      = hop * RING_R;
        nodesMap.get(id).x = Math.round(Math.cos(angle) * r);
        nodesMap.get(id).y = Math.round(Math.sin(angle) * r);
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   BFS — connected component detection  (for global graph)
═══════════════════════════════════════════════════════════════ */
function computeComponents(nodeIds, edges) {
  const adj = new Map();
  nodeIds.forEach(id => adj.set(id, []));
  edges.forEach(e => { adj.get(e.from)?.push(e.to); adj.get(e.to)?.push(e.from); });
  const compMap = new Map();
  let idx = 0;
  nodeIds.forEach(start => {
    if (compMap.has(start)) return;
    const q = [start];
    while (q.length) {
      const cur = q.shift();
      if (compMap.has(cur)) continue;
      compMap.set(cur, idx);
      adj.get(cur)?.forEach(nb => { if (!compMap.has(nb)) q.push(nb); });
    }
    idx++;
  });
  return { compMap, total: idx };
}

function compHue(i, total) { return (200 + i * (360 / Math.max(total, 1))) % 360; }
const LAYER_LIT = { L1_Collector: 36, L2_Distributor: 44, L3_Terminal: 52, default: 48 };
const LAYER_SAT = { L1_Collector: 88, L2_Distributor: 80, L3_Terminal: 72, default: 74 };
function nodeColorGlobal(ci, total, layer, isHub) {
  const h = compHue(ci, total);
  if (isHub) return { bg: `hsl(${h},95%,36%)`, border: `hsl(${h},95%,20%)`, glow: `hsla(${h},95%,36%,0.6)` };
  const s = LAYER_SAT[layer] ?? LAYER_SAT.default;
  const l = LAYER_LIT[layer] ?? LAYER_LIT.default;
  return { bg: `hsl(${h},${s}%,${l}%)`, border: `hsl(${h},${s}%,${l-14}%)`, glow: `hsla(${h},${s}%,${l}%,0.4)` };
}

const WEB_THRESHOLD = 0.55;

/* ═══════════════════════════════════════════════════════════════
   CONNECTION PATH PANEL  (shown inside detail panel for trace)
═══════════════════════════════════════════════════════════════ */
function ConnectionChain({ path, rootId }) {
  if (!path) return (
    <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 7, padding: '7px 10px' }}>
      ⚠ Connection path not found in traced data. May be a reverse-flow node.
    </div>
  );
  if (path.length === 0) return (
    <div style={{ fontSize: 11, color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 7, padding: '7px 10px' }}>
      🎯 This IS the investigated root account.
    </div>
  );

  const hopPal = HOP_PALETTE[Math.min(path.length, 4)];

  return (
    <div>
      {/* Hop badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ background: hopPal.bg, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#fff' }}>
          {path.length === 1 ? '⚡ Direct Connection' : `🔗 ${path.length} Hops Away`}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {path.length === 1 ? 'Directly transacted with your account' : `Connected through ${path.length - 1} intermediate account${path.length > 2 ? 's' : ''}`}
        </span>
      </div>

      {/* Chain visualisation */}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
        Connection Chain:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Root */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: HOP_PALETTE[0].bg, flexShrink: 0 }}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#f87171', fontWeight: 700, wordBreak: 'break-all' }}>
            🎯 {rootId}
          </span>
        </div>
        {path.map((step, i) => {
          const pal = HOP_PALETTE[Math.min(i + 1, 4)];
          return (
            <React.Fragment key={i}>
              {/* Arrow + amount */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 12 }}>
                <div style={{ width: 1, height: 8, background: pal.bg, flexShrink: 0 }}/>
                <span style={{ fontSize: 9.5, color: pal.bg, fontWeight: 700 }}>
                  ↓ ₹{step.tx.amount?.toLocaleString()} {step.tx.timestamp ? `(${step.tx.timestamp.slice(0, 10)})` : ''}
                </span>
              </div>
              {/* Node */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: pal.bg, flexShrink: 0 }}/>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#f0f6ff', wordBreak: 'break-all' }}>
                  {i === path.length - 1 ? <strong>{step.to}</strong> : step.to}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', background: 'rgba(9,18,35,0.6)', borderRadius: 7, padding: '7px 10px', lineHeight: 1.55 }}>
        <strong style={{ color: '#f0f6ff' }}>Why is this account here?</strong><br/>
        {path.length === 1
          ? `This account had a direct transaction of ₹${path[0].tx.amount?.toLocaleString()} with the investigated account.`
          : `Funds from the investigated account reached this account after passing through ${path.length - 1} intermediate account${path.length > 2 ? 's' : ''}. Total traced chain: ${path.length} transaction${path.length > 1 ? 's' : ''}.`}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOP LEGEND (trace graph specific)
═══════════════════════════════════════════════════════════════ */
function HopLegend() {
  return (
    <div style={{
      position: 'absolute', bottom: 50, left: 14, zIndex: 10,
      background: 'rgba(9,18,35,0.94)', border: '1px solid rgba(99,179,237,0.2)',
      borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(16px)',
      minWidth: 230, boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#7a9bbf', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Layers size={11}/> Connection Distance
      </div>
      {HOP_PALETTE.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: p.bg, flexShrink: 0, boxShadow: `0 0 6px ${p.glow}` }}/>
          <div>
            <div style={{ fontSize: 11, color: '#f0f6ff', fontWeight: 600 }}>{p.label}</div>
            <div style={{ fontSize: 9.5, color: '#7a9bbf' }}>
              {i === 0 && 'The account you are investigating'}
              {i === 1 && 'Sent/received directly — 1 transaction away'}
              {i === 2 && 'Connected through 1 intermediate account'}
              {i === 3 && 'Connected through 2 intermediate accounts'}
              {i === 4 && 'Connected through 3 intermediate accounts'}
            </div>
          </div>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(99,179,237,0.15)', marginTop: 10, paddingTop: 10, fontSize: 10, color: '#7a9bbf', lineHeight: 1.6 }}>
        <strong style={{ color: '#c8d8f0' }}>Click any node</strong> → see the exact<br/>
        money chain from ROOT to that account<br/>
        <strong style={{ color: '#c8d8f0' }}>Edges</strong> = actual ₹ transfers
      </div>
    </div>
  );
}

function GlobalLegend({ compColors }) {
  return (
    <div style={{
      position: 'absolute', bottom: 50, left: 14, zIndex: 10,
      background: 'rgba(9,18,35,0.94)', border: '1px solid rgba(99,179,237,0.2)',
      borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(16px)',
      minWidth: 220, boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#7a9bbf', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Layers size={11}/> Legend
      </div>
      {[
        { color: 'hsl(30,95%,36%)',  label: '🔥 Hub Node',     desc: 'High-risk central account' },
        { color: 'hsl(200,88%,36%)', label: 'L1 Collector',     desc: 'Receives from many sources' },
        { color: 'hsl(270,80%,44%)', label: 'L2 Distributor',   desc: 'Receives & redistributes' },
        { color: 'hsl(200,72%,52%)', label: 'L3 Terminal',       desc: 'Exit node of fund flow' },
      ].map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: item.color, flexShrink: 0, marginTop: 2 }}/>
          <div>
            <div style={{ fontSize: 11, color: '#f0f6ff', fontWeight: 600 }}>{item.label}</div>
            <div style={{ fontSize: 10, color: '#7a9bbf' }}>{item.desc}</div>
          </div>
        </div>
      ))}
      {compColors.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(99,179,237,0.15)', marginTop: 8, paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: '#c8d8f0', marginBottom: 5, fontWeight: 600 }}>
            {compColors.length} Connected Groups (same color = connected)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {compColors.slice(0, 16).map((c, i) => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c, boxShadow: `0 0 5px ${c}77` }} title={`Group ${i+1}`}/>
            ))}
          </div>
        </div>
      )}
      <div style={{ borderTop: '1px solid rgba(99,179,237,0.15)', marginTop: 10, paddingTop: 10, fontSize: 10, color: '#7a9bbf', lineHeight: 1.6 }}>
        <strong style={{ color: '#c8d8f0' }}>Zoom out</strong> → spider-web overview<br/>
        <strong style={{ color: '#c8d8f0' }}>Zoom in</strong> → account + amount detail
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATS RIBBON
═══════════════════════════════════════════════════════════════ */
function StatsRibbon({ data, isWebMode }) {
  if (!data) return null;
  const hubs = (data.nodes||[]).filter(n=>n.is_hub).length;
  return (
    <div style={{
      position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
      display: 'flex', background: 'rgba(9,18,35,0.92)',
      border: '1px solid rgba(99,179,237,0.22)', borderRadius: 10, overflow: 'hidden',
      backdropFilter: 'blur(14px)', boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
    }}>
      {[
        { icon: <Circle size={11}/>,       val: data.total_nodes||0, lbl: 'Accounts',   clr: '#60a5fa' },
        { icon: <Activity size={11}/>,     val: data.total_edges||0, lbl: 'Transfers',  clr: '#34d399' },
        { icon: <AlertTriangle size={11}/>,val: hubs,                 lbl: 'Hubs',       clr: '#f97316' },
        { icon: <Eye size={11}/>,          val: isWebMode ? '🕸 Web' : '🌿 Detail', lbl: 'View',   clr: isWebMode ? '#fbbf24' : '#a78bfa' },
      ].map((s,i,arr) => (
        <div key={i} style={{ padding: '7px 14px', borderRight: i<arr.length-1?'1px solid rgba(99,179,237,0.12)':'none', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: s.clr, marginBottom: 1 }}>
            {s.icon}<strong style={{ fontSize: 13, fontFamily: 'var(--font-heading)' }}>{s.val}</strong>
          </div>
          <div style={{ fontSize: 9, color: '#7a9bbf', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.lbl}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CTRL BUTTON
═══════════════════════════════════════════════════════════════ */
function Btn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(41,121,255,0.07)', border: '1px solid rgba(99,179,237,0.18)',
      borderRadius: 7, color: '#c8d8f0', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
    }}
      onMouseEnter={e => { e.currentTarget.style.background='rgba(41,121,255,0.25)'; e.currentTarget.style.color='#93c5fd'; }}
      onMouseLeave={e => { e.currentTarget.style.background='rgba(41,121,255,0.07)'; e.currentTarget.style.color='#c8d8f0'; }}
    >{children}</button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function NetworkGraphView() {
  const { selectedAccountId, selectAccount } = useInvestigation();
  const containerRef  = useRef(null);
  const networkRef    = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const compMapRef    = useRef(new Map());
  const traceDataRef  = useRef(null);
  const edgesListRef  = useRef([]);

  const [graphMode, setGraphMode]   = useState('trace');
  const [traceData, setTraceData]   = useState(null);
  const [globalData, setGlobalData] = useState(null);
  const [hopFilter, setHopFilter]   = useState('ALL');
  const [pathId, setPathId]         = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [connPath, setConnPath]     = useState(undefined); // undefined=loading, null=not found, []=root, array=chain
  const [loading, setLoading]       = useState(true);
  const [stabilized, setStabilized] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [isWebMode, setIsWebMode]   = useState(true);
  const [compColors, setCompColors] = useState([]);

  /* ── Data fetch ── */
  useEffect(() => {
    if (graphMode !== 'trace') return;
    setLoading(true); setStabilized(false);
    setSelectedNode(null); setSelectedEdge(null); setConnPath(undefined);
    traceAccountFunds(selectedAccountId, { maxHops: 4, maxOutgoing: 20, maxPaths: 100 })
      .then(d => { setTraceData(d); traceDataRef.current = d; setLoading(false); })
      .catch(() => { setTraceData(null); setLoading(false); });
  }, [selectedAccountId, graphMode]);

  useEffect(() => {
    if (graphMode !== 'global') return;
    setLoading(true); setStabilized(false);
    setSelectedNode(null); setSelectedEdge(null);
    fetchGlobalNetworkGraph(25)
      .then(d => { setGlobalData(d); setLoading(false); })
      .catch(() => { setGlobalData(null); setLoading(false); });
  }, [graphMode]);

  /* ═══════════════════════════════════════════════════════════
     BUILD GRAPH
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!containerRef.current) return;

    /* ──────── TRACE — RADIAL SPIDER WEB ──────── */
    if (graphMode === 'trace' && traceData?.paths) {
      const nodesMap  = new Map();
      const edgesArr  = [];
      const edgeKeys  = new Set();

      // ── ROOT node — bright red ellipse, left anchor ──
      nodesMap.set(selectedAccountId, {
        id:    selectedAccountId,
        label: `🎯 ROOT\n${selectedAccountId}`,
        color: {
          background: '#dc2626', border: '#7f1d1d',
          highlight: { background: '#ef4444', border: '#450a0a' },
        },
        font:        { color: '#ffffff', size: 13, bold: true },
        shape:       'ellipse',
        size:        34,
        level:       0,
        shadow:      { enabled: true, color: 'rgba(220,38,38,0.5)', size: 12, x: 0, y: 0 },
      });

      traceData.paths.forEach(path => {
        if (pathId && path.path_id !== pathId) return;
        path.transactions.forEach(tx => {
          if (hopFilter !== 'ALL' && tx.hop > Number(hopFilter)) return;

          // ── Sender node — blue box ──
          if (!nodesMap.has(tx.sender_account)) {
            nodesMap.set(tx.sender_account, {
              id:    tx.sender_account,
              label: tx.sender_account,
              color: {
                background: '#1e40af', border: '#1e3a8a',
                highlight: { background: '#2563eb', border: '#1e40af' },
              },
              font:        { color: '#ffffff', size: 11, bold: true },
              shape:       'box',
              size:        18,
              borderWidth: 2,
              level:       tx.hop - 1,
            });
          }

          // ── Receiver node — purple box ──
          if (!nodesMap.has(tx.receiver_account)) {
            nodesMap.set(tx.receiver_account, {
              id:    tx.receiver_account,
              label: tx.receiver_account,
              color: {
                background: '#6d28d9', border: '#4c1d95',
                highlight: { background: '#7c3aed', border: '#6d28d9' },
              },
              font:        { color: '#ffffff', size: 11, bold: true },
              shape:       'box',
              size:        18,
              borderWidth: 2,
              level:       tx.hop,
            });
          }

          // ── Edge ──
          const key = `${tx.sender_account}→${tx.receiver_account}__${tx.transaction_id}`;
          if (!edgeKeys.has(key)) {
            edgeKeys.add(key);
            edgesArr.push({
              id:   key,
              from: tx.sender_account,
              to:   tx.receiver_account,
              label: `₹${(tx.amount / 1000).toFixed(1)}k`,
              arrows: { to: { enabled: true, scaleFactor: 1.4 } },
              width:  3,
              smooth: { type: 'curvedCW', roundness: 0.15 },
              color:  { color: '#1d4ed8', highlight: '#3b82f6', hover: '#60a5fa' },
              font:   { color: '#1e3a8a', size: 10, background: '#dbeafe', strokeWidth: 0, bold: true },
              rawTx:  tx,
            });
          }
        });
      });

      edgesListRef.current = edgesArr;
      const nodesDS = new DataSet(Array.from(nodesMap.values()));
      const edgesDS = new DataSet(edgesArr);

      const network = new VisNetwork(containerRef.current, { nodes: nodesDS, edges: edgesDS }, {
        layout: {
          hierarchical: {
            enabled:         true,
            direction:       'LR',
            sortMethod:      'directed',
            nodeSpacing:     180,
            levelSeparation: 240,
          },
        },
        physics: { hierarchical: { enabled: true } },
        interaction: { dragNodes: true, dragView: true, zoomView: true, hover: true, tooltipDelay: 80 },
        nodes:  { borderWidthSelected: 3 },
        edges:  { chosen: true, selectionWidth: 2 },
      });
      networkRef.current = network;

      network.on('beforeDrawing', ctx => {
        ctx.save(); ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle = '#f8faff';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
      });

      network.on('stabilized', () => {
        network.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
        setStabilized(true);
      });

      network.on('click', params => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          setSelectedEdge(null);
          if (nodeId === selectedAccountId) {
            setConnPath([]);
          } else {
            setConnPath(traceConnectionPath(traceDataRef.current, selectedAccountId, nodeId));
          }
          fetchAccountDetails(nodeId)
            .then(setSelectedNode)
            .catch(() => setSelectedNode({ account_id: nodeId }));
        } else if (params.edges.length > 0) {
          setSelectedNode(null); setConnPath(undefined);
          const ev = edgesArr.find(e => e.id === params.edges[0]);
          if (ev) setSelectedEdge(ev.rawTx);
        } else { setSelectedNode(null); setSelectedEdge(null); setConnPath(undefined); }
      });

      return () => network.destroy();
    }

    /* ──────── GLOBAL SPIDER-WEB TOPOLOGY ──────── */
    if (graphMode === 'global' && globalData?.nodes) {
      const allIds = globalData.nodes.map(n => n.id);
      const { compMap, total } = computeComponents(allIds, globalData.edges || []);
      compMapRef.current = compMap;

      const colorList = Array.from({ length: total }, (_, i) => `hsl(${compHue(i,total)},75%,45%)`);
      setCompColors(colorList);

      const vols   = globalData.nodes.map(n => n.tx_volume || n.total_transactions || 1);
      const minVol = Math.min(...vols), maxVol = Math.max(...vols);
      const sizeFn = v => minVol===maxVol ? 14 : 8 + ((v-minVol)/(maxVol-minVol))*30;

      const amts   = globalData.edges.map(e => e.amount||1);
      const minAmt = Math.min(...amts), maxAmt = Math.max(...amts);
      const wFn    = a => minAmt===maxAmt ? 1.5 : 1+((a-minAmt)/(maxAmt-minAmt))*5;
      const eClrFn = a => {
        const r = minAmt===maxAmt ? 0.5 : (a-minAmt)/(maxAmt-minAmt);
        return `hsl(${Math.round(210-r*185)},${Math.round(68+r*22)}%,${Math.round(48-r*12)}%)`;
      };

      const nodesList = globalData.nodes.map(n => {
        const ci = compMap.get(n.id)??0;
        const { bg, border, glow } = nodeColorGlobal(ci, total, n.layer, n.is_hub);
        const vol = n.tx_volume||n.total_transactions||1;
        const sz  = n.is_hub ? Math.max(sizeFn(vol),26) : sizeFn(vol);
        return {
          id: n.id,
          label: n.is_hub ? `🔥 ${n.id}\n${n.layer||''}` : n.id,
          title: `Account: ${n.id}\nLayer: ${n.layer||'?'}\n${n.is_hub?'⚠ HUB':''}`,
          color: { background: bg, border, highlight: { background: bg, border: '#ffffff' }, hover: { background: bg, border: '#ffffff' } },
          font: { color: '#ffffff', size: n.is_hub?12:9, bold: true, multi: true,
                  strokeWidth: 3, strokeColor: 'rgba(0,0,0,0.65)', vadjust: 0,
                  scaling: { min: 0, max: n.is_hub?14:11, drawThreshold: n.is_hub?4:7 } },
          shape: 'dot', size: sz, borderWidth: n.is_hub?3:1.5,
          shadow: n.is_hub ? { enabled:true, color:glow, size:18, x:0, y:0 } : { enabled:true, color:`${bg}44`, size:6, x:0, y:0 },
          scaling: { min: Math.max(sz*0.5,5), max: sz*2.2, label: { enabled:true, min:0, max:n.is_hub?14:11, drawThreshold:n.is_hub?4:7 } },
          _comp: ci, _layer: n.layer, _isHub: n.is_hub,
        };
      });

      const edgesList = globalData.edges.map(e => ({
        id: e.id, from: e.from, to: e.to,
        label: `₹${(e.amount/1000).toFixed(0)}k`,
        title: `₹${e.amount?.toLocaleString()}\n${e.from} → ${e.to}`,
        arrows: { to: { enabled:true, scaleFactor: 0.7+wFn(e.amount||1)*0.08 } },
        width: wFn(e.amount||1),
        smooth: { type:'dynamic', roundness:0.25 },
        color: { color: eClrFn(e.amount||1), highlight:'#ffffff', hover:'#ffffff', opacity:0.55 },
        font: { color:'#0f172a', size:9, background:'rgba(248,250,255,0.9)', strokeWidth:0, bold:true,
                scaling: { min:0, max:11, drawThreshold:8 } },
        scaling: { label:{ enabled:true, min:0, max:11, drawThreshold:8 } },
        rawTx: { sender_account:e.from, receiver_account:e.to, amount:e.amount, timestamp:e.timestamp, transaction_id:e.transaction_id },
      }));

      edgesListRef.current = edgesList;
      const nodesDS = new DataSet(nodesList);
      const edgesDS = new DataSet(edgesList);

      const options = {
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant:-60, centralGravity:0.004, springLength:180, springConstant:0.06, damping:0.45, avoidOverlap:0.8 },
          stabilization: { enabled:true, iterations:350, updateInterval:25, fit:true },
          maxVelocity: 80, minVelocity: 0.4,
        },
        interaction: { dragNodes:true, dragView:true, zoomView:true, hover:true, tooltipDelay:60, navigationButtons:false },
        nodes: { borderWidthSelected:4 }, edges: { chosen:true, selectionWidth:3, hoverWidth:1.5 },
        configure: { enabled:false },
      };

      const network = new VisNetwork(containerRef.current, { nodes:nodesDS, edges:edgesDS }, options);
      networkRef.current = network;

      network.on('beforeDrawing', ctx => {
        ctx.save(); ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle = '#f8faff';
        ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
        ctx.restore();
      });

      network.on('stabilizationIterationsDone', () => {
        network.setOptions({ physics:{ enabled:false } });
        network.fit({ animation:{ duration:600, easingFunction:'easeInOutQuad' } });
        setStabilized(true); setIsWebMode(true);
      });

      network.on('zoom', params => setIsWebMode(params.scale < WEB_THRESHOLD));

      network.on('click', params => {
        if (params.nodes.length > 0) {
          setSelectedEdge(null);
          fetchAccountDetails(params.nodes[0])
            .then(setSelectedNode)
            .catch(() => setSelectedNode({ account_id:params.nodes[0], layer:'Unknown' }));
        } else if (params.edges.length > 0) {
          setSelectedNode(null);
          const ev = edgesList.find(ev=>ev.id===params.edges[0]);
          if (ev) setSelectedEdge(ev.rawTx);
        } else { setSelectedNode(null); setSelectedEdge(null); }
      });

      return () => network.destroy();
    }
  }, [graphMode, traceData, globalData, hopFilter, pathId]);

  /* ── Controls ── */
  const pan = useCallback(dir => {
    const net=networkRef.current; if(!net)return;
    const p=net.getViewPosition(), off=200;
    net.moveTo({ position:{ x:p.x+(dir==='right'?off:dir==='left'?-off:0), y:p.y+(dir==='down'?off:dir==='up'?-off:0) }, animation:{duration:280,easingFunction:'easeInOutQuad'} });
  }, []);
  const zoomIn  = () => networkRef.current?.moveTo({ scale:networkRef.current.getScale()*1.4,  animation:{duration:250,easingFunction:'easeInOutQuad'} });
  const zoomOut = () => networkRef.current?.moveTo({ scale:networkRef.current.getScale()/1.4,  animation:{duration:250,easingFunction:'easeInOutQuad'} });
  const fit     = () => networkRef.current?.fit({ animation:{duration:500,easingFunction:'easeInOutQuad'} });

  const onTouchStart = e => { if(e.touches?.[0]) touchStartRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; };
  const onTouchEnd   = e => {
    if(!e.changedTouches?.[0])return;
    const dx=e.changedTouches[0].clientX-touchStartRef.current.x, dy=e.changedTouches[0].clientY-touchStartRef.current.y;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40) pan(dx>0?'left':'right');
    else if(Math.abs(dy)>40) pan(dy>0?'up':'down');
  };

  useEffect(() => {
    const onKey = e => { if(e.key==='Escape'&&fullscreen) setFullscreen(false); };
    window.addEventListener('keydown',onKey); return ()=>window.removeEventListener('keydown',onKey);
  }, [fullscreen]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="animate-in">

      {!fullscreen && (
        <>
          <div className="page-header flex-between" style={{ marginBottom:14 }}>
            <div>
              <h1 className="page-title">Network Transaction Graph Workstation</h1>
              <p className="page-description">
                {graphMode==='trace'
                  ? `🎯 Showing all accounts connected to ${selectedAccountId} — zoom in to read IDs & amounts · click any node to trace the connection chain`
                  : '🕸 Zoom out → spider-web overview · Zoom in → account & transaction detail'}
              </p>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <button className={`btn ${graphMode==='trace'?'btn-primary':'btn-secondary'}`}
                onClick={() => { setGraphMode('trace'); setSelectedNode(null); setSelectedEdge(null); }}>
                <GitCommit size={14}/><span>Trace My Account</span>
              </button>
              <button className={`btn ${graphMode==='global'?'btn-primary':'btn-secondary'}`}
                onClick={() => { setGraphMode('global'); setSelectedNode(null); setSelectedEdge(null); }}>
                <Globe size={14}/><span>Full Network</span>
              </button>
              <button className="btn btn-secondary" onClick={() => setFullscreen(true)}>
                <Maximize2 size={14}/><span>Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div className="card flex-between" style={{ padding:'11px 18px', marginBottom:14, flexWrap:'wrap', gap:10 }}>
            {graphMode==='trace' ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.7px' }}>Show:</span>
                  {[
                    { v:'ALL', lbl:'All Hops' },
                    { v:'1',   lbl:'Direct Only' },
                    { v:'2',   lbl:'Up to 2 Hops' },
                    { v:'3',   lbl:'Up to 3 Hops' },
                    { v:'4',   lbl:'Up to 4 Hops' },
                  ].map(h => (
                    <button key={h.v} className={`btn ${hopFilter===h.v?'btn-primary':'btn-secondary'}`}
                      style={{ padding:'4px 11px', fontSize:11 }} onClick={() => setHopFilter(h.v)}>
                      {h.lbl}
                    </button>
                  ))}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase' }}>Path:</span>
                  <select value={pathId||''} onChange={e => setPathId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">All Paths</option>
                    {traceData?.paths?.slice(0,20).map(p => (
                      <option key={p.path_id} value={p.path_id}>Path #{p.path_id} — {p.hop_count} Hops</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span className={`badge ${isWebMode?'badge-medium':'badge-layer-l1'}`}>
                  {isWebMode ? '🕸 Spider Web Overview' : '🔍 Detail View'}
                </span>
                <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                  {isWebMode ? 'Scroll ↑ to zoom in — nodes expand with labels & amounts' : 'Scroll ↓ to return to spider-web view'}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ GRAPH CANVAS ═══ */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{
          position: fullscreen?'fixed':'relative', inset:fullscreen?0:undefined,
          width: fullscreen?'100vw':'100%', height:fullscreen?'100vh':'calc(100vh - 215px)',
          minHeight: fullscreen?undefined:560, background:'#f8faff',
          border: fullscreen?'none':'1px solid rgba(99,179,237,0.15)',
          borderRadius: fullscreen?0:16, overflow:'hidden',
          zIndex: fullscreen?9999:1, boxShadow:fullscreen?'none':'0 4px 24px rgba(0,0,0,0.4)',
        }}>

        {/* CLOSE FULLSCREEN */}
        {fullscreen && (
          <button onClick={() => setFullscreen(false)} title="Close Fullscreen (Esc)"
            style={{ position:'absolute', top:16, right:16, zIndex:20, display:'flex', alignItems:'center', gap:8, background:'rgba(220,38,38,0.92)', border:'1px solid rgba(255,100,100,0.45)', borderRadius:10, padding:'10px 18px', color:'#ffffff', fontFamily:'var(--font-body)', fontSize:13, fontWeight:700, cursor:'pointer', backdropFilter:'blur(10px)', boxShadow:'0 4px 20px rgba(220,38,38,0.4)', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,1)'; e.currentTarget.style.transform='scale(1.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(220,38,38,0.92)'; e.currentTarget.style.transform='scale(1)'; }}>
            <X size={15}/> Close Fullscreen <span style={{ fontSize:10, opacity:0.7 }}>(Esc)</span>
          </button>
        )}

        {/* STATS RIBBON — global only */}
        {graphMode==='global' && !loading && <StatsRibbon data={globalData} isWebMode={isWebMode}/>}

        {/* TRACE EXPLANATION BANNER */}
        {graphMode==='trace' && !loading && stabilized && (
          <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', zIndex:10, background:'rgba(9,18,35,0.92)', border:'1px solid rgba(99,179,237,0.22)', borderRadius:10, padding:'8px 18px', backdropFilter:'blur(14px)', boxShadow:'0 4px 20px rgba(0,0,0,0.45)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:12 }}>
            {HOP_PALETTE.slice(0,5).map((p,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:p.bg, boxShadow:`0 0 5px ${p.glow}` }}/>
                <span style={{ fontSize:10.5, color:i===0?'#f87171':'#c8d8f0', fontWeight:i===0?700:400 }}>
                  {p.label}
                </span>
              </div>
            ))}
            <div style={{ width:1, background:'rgba(99,179,237,0.2)', alignSelf:'stretch' }}/>
            <span style={{ fontSize:10.5, color:'#7a9bbf' }}>Click any node → see connection chain</span>
          </div>
        )}

        {/* CONTROLS */}
        <div style={{ position:'absolute', top:14, left:14, zIndex:10, display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ display:'flex', gap:3, background:'rgba(9,18,35,0.9)', border:'1px solid rgba(99,179,237,0.2)', borderRadius:10, padding:5, backdropFilter:'blur(12px)', boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
            <Btn onClick={zoomIn}  title="Zoom In"><ZoomIn  size={13}/></Btn>
            <Btn onClick={zoomOut} title="Zoom Out"><ZoomOut size={13}/></Btn>
            <div style={{ width:1, background:'rgba(99,179,237,0.15)', margin:'0 2px' }}/>
            <Btn onClick={fit}     title="Fit All"><RefreshCw size={13}/></Btn>
          </div>
          <div style={{ background:'rgba(9,18,35,0.9)', border:'1px solid rgba(99,179,237,0.2)', borderRadius:10, padding:5, backdropFilter:'blur(12px)', boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
            <div style={{ display:'grid', gridTemplateColumns:'30px 30px 30px', gridTemplateRows:'30px 30px 30px', gap:2 }}>
              <div/><Btn onClick={()=>pan('up')}    title="Pan Up"><ArrowUp    size={12}/></Btn><div/>
              <Btn onClick={()=>pan('left')}  title="Pan Left"><ArrowLeft  size={12}/></Btn>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(99,179,237,0.3)',fontSize:12 }}>✛</div>
              <Btn onClick={()=>pan('right')} title="Pan Right"><ArrowRight size={12}/></Btn>
              <div/><Btn onClick={()=>pan('down')}  title="Pan Down"><ArrowDown  size={12}/></Btn><div/>
            </div>
          </div>
          <button onClick={() => setShowLegend(v=>!v)} style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:5, background:showLegend?'rgba(41,121,255,0.25)':'rgba(9,18,35,0.9)', border:`1px solid ${showLegend?'rgba(41,121,255,0.5)':'rgba(99,179,237,0.2)'}`, borderRadius:8, padding:'6px 10px', color:showLegend?'#93c5fd':'#7a9bbf', fontSize:11, fontFamily:'var(--font-body)', cursor:'pointer', backdropFilter:'blur(12px)', fontWeight:600, transition:'all 0.2s' }}>
            <Info size={12}/> Legend
          </button>
          {!fullscreen && (
            <button onClick={() => setFullscreen(true)} style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:5, background:'rgba(9,18,35,0.9)', border:'1px solid rgba(99,179,237,0.2)', borderRadius:8, padding:'6px 10px', color:'#7a9bbf', fontSize:11, fontFamily:'var(--font-body)', cursor:'pointer', backdropFilter:'blur(12px)', fontWeight:600, transition:'all 0.2s' }}>
              <Maximize2 size={12}/> Fullscreen
            </button>
          )}
        </div>

        {/* LEGEND */}
        {showLegend && (graphMode==='trace' ? <HopLegend/> : <GlobalLegend compColors={compColors}/>)}

        {/* DETAIL PANEL */}
        {(selectedNode || selectedEdge) && (
          <div style={{ position:'absolute', top:14, right:fullscreen?80:14, zIndex:10, width:320, maxHeight:'calc(100% - 28px)', overflowY:'auto', background:'rgba(9,18,35,0.96)', border:'1px solid rgba(99,179,237,0.28)', borderRadius:14, padding:'16px 18px', boxShadow:'0 8px 40px rgba(0,0,0,0.6)', backdropFilter:'blur(16px)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <strong style={{ fontSize:13, color:'#93c5fd' }}>
                {selectedNode ? '📍 Account Profile' : '⟶ Transfer Detail'}
              </strong>
              <button style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}
                onClick={() => { setSelectedNode(null); setSelectedEdge(null); setConnPath(undefined); }}>
                <X size={14}/>
              </button>
            </div>

            {selectedNode && (() => {
              const pr     = selectedNode.percentiles || {};
              const isHigh = (pr.final||0) >= 80;
              const hopNum = traceData?.paths
                ?.flatMap(p=>p.transactions)
                ?.find(tx => tx.receiver_account===selectedNode.account_id || tx.sender_account===selectedNode.account_id)
                ?._hop ?? 0;
              const pal  = HOP_PALETTE[Math.min(hopNum, 4)];
              const ci   = compMapRef.current.get(selectedNode.account_id);
              const nc   = graphMode==='global' && ci !== undefined ? compColors[ci] : pal.bg;

              return (
                <div>
                  {/* Colored ID banner */}
                  <div style={{ background:`${nc}22`, border:`1.5px solid ${nc}55`, borderRadius:8, padding:'8px 12px', marginBottom:12 }}>
                    <div style={{ fontSize:11.5, fontFamily:'var(--font-mono)', fontWeight:700, color:nc, wordBreak:'break-all' }}>
                      {selectedNode.account_id}
                    </div>
                    <div style={{ display:'flex', gap:5, marginTop:5, flexWrap:'wrap' }}>
                      <span className={`badge ${isHigh?'badge-high':'badge-low'}`} style={{ fontSize:9 }}>
                        {selectedNode.review_priority_label||(isHigh?'HIGH RISK':'LOW RISK')}
                      </span>
                      {selectedNode.layer && <span className="badge badge-layer-l1" style={{ fontSize:9 }}>{selectedNode.layer}</span>}
                      {graphMode==='trace' && selectedNode.account_id !== selectedAccountId && (
                        <span style={{ fontSize:9, fontWeight:700, background:`${pal.bg}22`, color:pal.bg, border:`1px solid ${pal.bg}44`, borderRadius:99, padding:'1px 7px' }}>
                          {pal.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CONNECTION CHAIN — trace mode only */}
                  {graphMode==='trace' && selectedNode.account_id !== selectedAccountId && (
                    <div style={{ marginBottom:14, background:'rgba(9,18,35,0.6)', borderRadius:10, padding:'12px 14px', border:'1px solid rgba(99,179,237,0.15)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#7a9bbf', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>
                        Why is this in the graph?
                      </div>
                      {connPath === undefined
                        ? <div style={{ fontSize:11, color:'#7a9bbf' }}>Computing chain...</div>
                        : <ConnectionChain path={connPath} rootId={selectedAccountId}/>}
                    </div>
                  )}

                  {/* Risk bars */}
                  {pr.final !== undefined && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Risk Scores</div>
                      {[
                        { lbl:'Fan Risk',    val:pr.fan },
                        { lbl:'Network',     val:pr.graph },
                        { lbl:'Temporal',    val:pr.temporal },
                        { lbl:'▶ Composite', val:pr.final, bold:true },
                      ].map((r,i) => (
                        <div key={i} style={{ marginBottom:5 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                            <span style={{ fontSize:11, color:r.bold?'#f0f6ff':'var(--text-muted)', fontWeight:r.bold?700:400 }}>{r.lbl}</span>
                            <span style={{ fontSize:11, fontWeight:700, color:(r.val||0)>=80?'#f87171':(r.val||0)>=60?'#fbbf24':'#34d399' }}>{r.val?.toFixed(1)}%</span>
                          </div>
                          <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ width:`${r.val||0}%`, height:'100%', borderRadius:99, transition:'width 0.8s ease', background:(r.val||0)>=80?'#ef4444':(r.val||0)>=60?'#f59e0b':'#10b981' }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedNode.rapid_pass_through?.is_candidate && (
                    <div style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:7, padding:'6px 10px', fontSize:11, color:'#fca5a5', marginBottom:10, display:'flex', gap:5, alignItems:'center' }}>
                      <AlertTriangle size={12}/> Rapid pass-through detected
                    </div>
                  )}

                  {selectedNode.why_review_reasons?.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:5 }}>Key Signals</div>
                      <ul style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:14, display:'flex', flexDirection:'column', gap:3, lineHeight:1.45 }}>
                        {selectedNode.why_review_reasons.slice(0,3).map((r,i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}

                  <button className="btn btn-primary" style={{ width:'100%', fontSize:12, padding:'7px 12px' }}
                    onClick={() => selectAccount(selectedNode.account_id,'investigation')}>
                    <Target size={13}/> Investigate This Account
                  </button>
                </div>
              );
            })()}

            {selectedEdge && (
              <div style={{ fontSize:12.5, display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { lbl:'Sender',   val:selectedEdge.sender_account,   clr:'#60a5fa' },
                  { lbl:'Receiver', val:selectedEdge.receiver_account, clr:'#c4b5fd' },
                ].map((r,i) => (
                  <div key={i}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>{r.lbl}</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, color:r.clr, wordBreak:'break-all' }}>{r.val}</div>
                  </div>
                ))}
                <div style={{ background:'rgba(41,121,255,0.1)', border:'1px solid rgba(41,121,255,0.25)', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>Transfer Amount</div>
                  <div style={{ fontSize:22, fontWeight:800, color:'#ffffff', fontFamily:'var(--font-heading)' }}>₹{selectedEdge.amount?.toLocaleString()}</div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                  <span style={{ color:'var(--text-muted)' }}>Timestamp</span>
                  <span style={{ color:'#c8d8f0' }}>{selectedEdge.timestamp||'—'}</span>
                </div>
                {selectedEdge.transaction_id && (
                  <div style={{ fontFamily:'var(--font-mono)', color:'#3d5a7a', fontSize:10, wordBreak:'break-all' }}>
                    Tx: {selectedEdge.transaction_id}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* BOTTOM HINT */}
        <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', zIndex:10, background:'rgba(9,18,35,0.82)', border:'1px solid rgba(99,179,237,0.18)', borderRadius:99, padding:'5px 14px', fontSize:10.5, color:'#7a9bbf', backdropFilter:'blur(8px)', whiteSpace:'nowrap', pointerEvents:'none', display:'flex', alignItems:'center', gap:6 }}>
          {graphMode==='trace'
            ? '🎯 Root = center · 🟠 Hop 1 = direct · 🟡 Hop 2+ = indirect · Click any node to see why it\'s connected'
            : '🕸 Zoom out = spider-web · 🔍 Zoom in = account & transaction detail · Click any node to inspect'}
        </div>

        {/* CANVAS / LOADING */}
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:14, background:'#f8faff' }}>
            <div style={{ width:44, height:44, border:'3px solid #dbeafe', borderTopColor:'#1e40af', borderRadius:'50%', animation:'spin 0.9s linear infinite' }}/>
            <div style={{ fontWeight:700, fontSize:15, color:'#1e3a8a' }}>
              {graphMode==='trace' ? `Tracing all connections of ${selectedAccountId}...` : 'Building spider-web topology...'}
            </div>
            <div style={{ fontSize:12, color:'#94a3b8' }}>
              {graphMode==='trace' ? 'Finding direct & indirect accounts up to 4 hops away' : 'Computing connected groups · assigning unique colors'}
            </div>
            <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
          </div>
        ) : (
          <div ref={containerRef} style={{ width:'100%', height:'100%', background:'#f8faff' }}/>
        )}
      </div>
    </div>
  );
}
