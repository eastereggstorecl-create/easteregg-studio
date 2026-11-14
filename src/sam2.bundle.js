"use strict";
var SAM2 = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    FrameEncoder: () => FrameEncoder,
    ImagePredictor: () => ImagePredictor,
    LABEL_PAD: () => LABEL_PAD,
    MultiObjectTracker: () => MultiObjectTracker,
    NON_OVERLAP_CLAMP: () => NON_OVERLAP_CLAMP,
    VideoTracker: () => VideoTracker,
    clampMaskInput: () => clampMaskInput,
    configureOrt: () => configureOrt,
    createImageSessions: () => createImageSessions,
    createSessions: () => createSessions,
    encodeImage: () => encodeImage,
    fetchLoader: () => fetchLoader,
    getOrt: () => getOrt,
    graphFiles: () => graphFiles,
    maskDownsample: () => maskDownsample,
    maskToImageData: () => maskToImageData,
    nonOverlapping: () => nonOverlapping,
    normalize: () => normalize,
    parseConstants: () => parseConstants,
    pickProvider: () => pickProvider,
    releaseSessions: () => releaseSessions,
    resizeAntialias: () => resizeAntialias,
    resizeToSquare: () => resizeToSquare,
    roundBf16: () => roundBf16,
    runHead: () => runHead,
    selectClosestCondFrames: () => selectClosestCondFrames,
    selectOutput: () => selectOutput,
    setOrt: () => setOrt,
    stabilityScore: () => stabilityScore,
    supportsShaderF16: () => supportsShaderF16,
    upsampleBilinear: () => upsampleBilinear,
    useFp16MemoryAttention: () => useFp16MemoryAttention,
    withMemoryTokens: () => withMemoryTokens
  });

  // src/constants.ts
  function num(raw, key) {
    const v = raw[key];
    if (typeof v !== "number") throw new Error(`constants: "${key}" must be a number`);
    return v;
  }
  function vec(raw, key, length) {
    const v = raw[key];
    if (!Array.isArray(v) || !v.every((x) => typeof x === "number")) {
      throw new Error(`constants: "${key}" must be an array of numbers`);
    }
    if (length !== void 0 && v.length !== length) {
      throw new Error(`constants: "${key}" has length ${v.length}, expected ${length}`);
    }
    return Float32Array.from(v);
  }
  function triple(raw, key) {
    const v = raw[key];
    if (!Array.isArray(v) || v.length !== 3 || !v.every((x) => typeof x === "number")) {
      throw new Error(`constants: "${key}" must be three numbers`);
    }
    return [v[0], v[1], v[2]];
  }
  function flatten(v) {
    return Array.isArray(v) && v.every((row) => Array.isArray(row)) ? v.flat() : v;
  }
  function parseConstants(json) {
    const raw = typeof json === "string" ? JSON.parse(json) : json;
    const hidden = num(raw, "hidden_dim");
    const memDim = num(raw, "mem_dim");
    const nMem = num(raw, "num_maskmem");
    const tpos = raw["maskmem_tpos_enc"];
    if (!Array.isArray(tpos) || tpos.length !== nMem) {
      throw new Error(`constants: "maskmem_tpos_enc" must have ${nMem} rows`);
    }
    const tposRows = tpos.map((row, i) => vec({ [`maskmem_tpos_enc[${i}]`]: row }, `maskmem_tpos_enc[${i}]`, memDim));
    const onlyPast = raw["only_obj_ptrs_in_the_past_for_eval"];
    if (typeof onlyPast !== "boolean") {
      throw new Error('constants: "only_obj_ptrs_in_the_past_for_eval" must be a boolean');
    }
    return {
      model: String(raw["model"] ?? ""),
      image_size: num(raw, "image_size"),
      embed_grid: num(raw, "embed_grid"),
      mask_size: num(raw, "mask_size"),
      hidden_dim: hidden,
      mem_dim: memDim,
      tokens_per_obj_ptr: num(raw, "tokens_per_obj_ptr"),
      num_maskmem: nMem,
      max_obj_ptrs_in_encoder: num(raw, "max_obj_ptrs_in_encoder"),
      max_cond_frames_in_attn: num(raw, "max_cond_frames_in_attn"),
      memory_temporal_stride_for_eval: num(raw, "memory_temporal_stride_for_eval"),
      only_obj_ptrs_in_the_past_for_eval: onlyPast,
      pixel_mean: triple(raw, "pixel_mean"),
      pixel_std: triple(raw, "pixel_std"),
      multimask_min_pt_num: num(raw, "multimask_min_pt_num"),
      multimask_max_pt_num: num(raw, "multimask_max_pt_num"),
      stability_delta: num(raw, "stability_delta"),
      stability_thresh: num(raw, "stability_thresh"),
      no_obj_score: num(raw, "no_obj_score"),
      mask_input_clamp: num(raw, "mask_input_clamp"),
      sigmoid_scale_for_mem_enc: num(raw, "sigmoid_scale_for_mem_enc"),
      sigmoid_bias_for_mem_enc: num(raw, "sigmoid_bias_for_mem_enc"),
      no_mem_embed: vec(raw, "no_mem_embed", hidden),
      maskmem_tpos_enc: tposRows,
      no_obj_ptr: vec(raw, "no_obj_ptr", hidden),
      no_obj_embed_spatial: vec(raw, "no_obj_embed_spatial", memDim),
      mask_downsample_weight: vec({ mask_downsample_weight: flatten(raw["mask_downsample_weight"]) }, "mask_downsample_weight", 16),
      mask_downsample_bias: vec(raw, "mask_downsample_bias", 1)[0]
    };
  }

  // src/sessions.ts
  var ortModule = null;
  function setOrt(ort) {
    ortModule = ort;
  }
  function getOrt() {
    if (ortModule === null) throw new Error("sam2: call setOrt(ort) before creating sessions");
    return ortModule;
  }
  function f32(data, dims) {
    return new (getOrt()).Tensor("float32", data, dims);
  }
  function i32(data, dims) {
    return new (getOrt()).Tensor("int32", data, dims);
  }
  function i64(data, dims) {
    return new (getOrt()).Tensor("int64", data, dims);
  }
  function data32(t, name) {
    if (t === void 0) throw new Error(`sam2: missing output "${name}"`);
    if (!(t.data instanceof Float32Array)) throw new Error(`sam2: output "${name}" is not float32`);
    return t.data;
  }
  async function runGraph(session, feeds, timings, label) {
    const t0 = performance.now();
    const out = await session.run(feeds);
    if (timings !== void 0 && label !== void 0) {
      (timings[label] ??= []).push(performance.now() - t0);
    }
    const result = {};
    for (const name of session.outputNames) result[name] = data32(out[name], name);
    return result;
  }
  function graphFiles(size = 512, files = {}, variant = {}) {
    return {
      imageEncoder: `image_encoder_${size}.int8.onnx`,
      samHead: `sam_head_${size}.onnx`,
      memoryEncoder: `memory_encoder_${size}.onnx`,
      memoryAttention: `memory_attention_${size}${variant.fp16MemoryAttention === true ? ".fp16" : ""}.onnx`,
      objectPointer: "object_pointer.onnx",
      objectPointerTpos: "object_pointer_tpos.onnx",
      ...files
    };
  }
  function useFp16MemoryAttention(provider, shaderF16) {
    return provider === "webgpu" && shaderF16;
  }
  function sessionOptions(provider) {
    return {
      executionProviders: provider === "webgpu" ? ["webgpu", "wasm"] : ["wasm"],
      // Fold the int8 weights' DequantizeLinear once at load instead of on every run.
      extra: { session: { disable_quant_qdq: "1" } }
    };
  }
  async function createRoles(roles, loadBytes, opts) {
    const ort = getOrt();
    const files = graphFiles(opts.size, opts.files, opts.variant);
    const out = {};
    for (const role of roles) {
      const file = files[role];
      opts.onProgress?.(file, 0);
      const bytes = await loadBytes(file, (frac) => opts.onProgress?.(file, Math.min(frac, 0.999)));
      out[role] = await ort.InferenceSession.create(bytes, sessionOptions(opts.provider));
      opts.onProgress?.(file, 1);
    }
    return out;
  }
  function createImageSessions(loadBytes, opts) {
    return createRoles(["imageEncoder", "samHead"], loadBytes, opts);
  }
  function createSessions(loadBytes, opts) {
    return createRoles(
      [
        "imageEncoder",
        "samHead",
        "memoryEncoder",
        "memoryAttention",
        "objectPointer",
        "objectPointerTpos"
      ],
      loadBytes,
      opts
    );
  }
  async function releaseSessions(set) {
    for (const s of Object.values(set)) await s?.release?.();
  }

  // src/preprocess.ts
  var f = Math.fround;
  function normalize(rgb, S, consts, stride = 3) {
    const n = S * S;
    if (rgb.length < n * stride) {
      throw new Error(`normalize: expected ${n * stride} bytes, got ${rgb.length}`);
    }
    const out = new Float32Array(3 * n);
    for (let c = 0; c < 3; c++) {
      const mean = consts.pixel_mean[c];
      const std = consts.pixel_std[c];
      const base = c * n;
      for (let i = 0; i < n; i++) {
        out[base + i] = (rgb[i * stride + c] / 255 - mean) / std;
      }
    }
    return out;
  }
  function linearTaps(nIn, nOut) {
    const scale = f(nIn / nOut);
    const i0 = new Int32Array(nOut);
    const i1 = new Int32Array(nOut);
    const w0 = new Float32Array(nOut);
    const w1 = new Float32Array(nOut);
    for (let i = 0; i < nOut; i++) {
      const src = Math.max(f(f(f(i + 0.5) * scale) - 0.5), 0);
      const lo = Math.floor(src);
      const w = f(src - lo);
      i0[i] = lo;
      i1[i] = Math.min(lo + 1, nIn - 1);
      w1[i] = w;
      w0[i] = f(1 - w);
    }
    return { i0, i1, w0, w1 };
  }
  function upsampleBilinear(src, srcSize, dstSize) {
    const h = typeof dstSize === "number" ? dstSize : dstSize.height;
    const w = typeof dstSize === "number" ? dstSize : dstSize.width;
    if (src.length < srcSize * srcSize) {
      throw new Error(`upsampleBilinear: expected ${srcSize * srcSize} values, got ${src.length}`);
    }
    const ty = linearTaps(srcSize, h);
    const tx = linearTaps(srcSize, w);
    const rows = new Float32Array(h * srcSize);
    for (let y = 0; y < h; y++) {
      const a = ty.i0[y] * srcSize;
      const b = ty.i1[y] * srcSize;
      const wa = ty.w0[y];
      const wb = ty.w1[y];
      const o = y * srcSize;
      for (let x = 0; x < srcSize; x++) {
        rows[o + x] = f(src[a + x] * wa) + f(src[b + x] * wb);
      }
    }
    const out = new Float32Array(h * w);
    for (let y = 0; y < h; y++) {
      const r = y * srcSize;
      const o = y * w;
      for (let x = 0; x < w; x++) {
        out[o + x] = f(rows[r + tx.i0[x]] * tx.w0[x]) + f(rows[r + tx.i1[x]] * tx.w1[x]);
      }
    }
    return out;
  }
  function roundBf16(x) {
    const out = new Float32Array(x);
    const u = new Uint32Array(out.buffer, out.byteOffset, out.length);
    for (let i = 0; i < u.length; i++) {
      const v = u[i];
      u[i] = v + 32767 + (v >>> 16 & 1) & 4294901760;
    }
    return out;
  }
  function antialiasTaps(nIn, nOut) {
    const scale = nIn / nOut;
    const support = Math.max(scale, 1);
    const inv = scale >= 1 ? 1 / scale : 1;
    const maxTaps = Math.ceil(2 * support) + 1;
    const start = new Int32Array(nOut);
    const count = new Int32Array(nOut);
    const weights = new Float32Array(nOut * maxTaps);
    for (let i = 0; i < nOut; i++) {
      const center = scale * (i + 0.5);
      const lo = Math.max(Math.trunc(center - support + 0.5), 0);
      const hi = Math.min(Math.trunc(center + support + 0.5), nIn);
      let total = 0;
      const row = [];
      for (let j = lo; j < hi; j++) {
        const w = Math.max(0, 1 - Math.abs((j - center + 0.5) * inv));
        row.push(w);
        total += w;
      }
      start[i] = lo;
      count[i] = hi - lo;
      for (let k = 0; k < row.length; k++) weights[i * maxTaps + k] = row[k] / total;
    }
    return { start, count, weights, maxTaps };
  }
  function resizeAntialias(src, srcSize, dstSize) {
    const sh = typeof srcSize === "number" ? srcSize : srcSize.height;
    const sw = typeof srcSize === "number" ? srcSize : srcSize.width;
    const h = typeof dstSize === "number" ? dstSize : dstSize.height;
    const w = typeof dstSize === "number" ? dstSize : dstSize.width;
    if (src.length < sh * sw) {
      throw new Error(`resizeAntialias: expected ${sh * sw} values, got ${src.length}`);
    }
    const ty = antialiasTaps(sh, h);
    const tx = antialiasTaps(sw, w);
    const rows = new Float32Array(h * sw);
    for (let y = 0; y < h; y++) {
      const lo = ty.start[y];
      const n = ty.count[y];
      const o = y * sw;
      for (let k = 0; k < n; k++) {
        const wk = ty.weights[y * ty.maxTaps + k];
        const r = (lo + k) * sw;
        for (let x = 0; x < sw; x++) rows[o + x] = f(rows[o + x] + f(src[r + x] * wk));
      }
    }
    const out = new Float32Array(h * w);
    for (let y = 0; y < h; y++) {
      const r = y * sw;
      const o = y * w;
      for (let x = 0; x < w; x++) {
        const lo = tx.start[x];
        const n = tx.count[x];
        let acc = 0;
        for (let k = 0; k < n; k++) {
          acc = f(acc + f(rows[r + lo + k] * tx.weights[x * tx.maxTaps + k]));
        }
        out[o + x] = acc;
      }
    }
    return out;
  }
  function maskDownsample(mask, S, weight, bias) {
    if (mask.length < S * S || S % 4 !== 0) throw new Error(`maskDownsample: need an [S, S] mask with S a multiple of 4`);
    if (weight.length !== 16) throw new Error("maskDownsample: weight must have 16 values");
    const s = S / 4;
    const out = new Float32Array(s * s);
    for (let i = 0; i < s; i++) {
      for (let j = 0; j < s; j++) {
        let acc = 0;
        for (let a = 0; a < 4; a++) {
          const r = (4 * i + a) * S + 4 * j;
          for (let b = 0; b < 4; b++) acc = f(acc + f(mask[r + b] * weight[4 * a + b]));
        }
        out[i * s + j] = f(acc + bias);
      }
    }
    return out;
  }

  // src/features.ts
  async function encodeImage(sessions, input, size, timings) {
    if (input.length !== 3 * size * size) {
      throw new Error(`encodeImage: expected ${3 * size * size} values, got ${input.length}`);
    }
    const out = await runGraph(
      sessions.imageEncoder,
      { image: f32(input, [1, 3, size, size]) },
      timings,
      "image_encoder"
    );
    return {
      imageEmbed: out["image_embed"],
      highResS0: out["high_res_feat_s0"],
      highResS1: out["high_res_feat_s1"],
      grid: size / 16
    };
  }
  function withMemoryTokens(feats, consts) {
    const hw = feats.grid * feats.grid;
    const channels = consts.no_mem_embed.length;
    const visionFeat = new Float32Array(channels * hw);
    const curr = new Float32Array(channels * hw);
    for (let c = 0; c < channels; c++) {
      const e = consts.no_mem_embed[c];
      const base = c * hw;
      for (let t = 0; t < hw; t++) {
        const v = feats.imageEmbed[base + t] - e;
        visionFeat[base + t] = v;
        curr[t * channels + c] = v;
      }
    }
    return { ...feats, visionFeat, curr };
  }

  // src/head.ts
  var LABEL_PAD = -1;
  var NUM_TOKENS = 4;
  async function runHead(sessions, feats, pointCoordsS, labels, maskInput, timings) {
    const g = feats.grid;
    const m = 4 * g;
    const p = labels.length;
    if (pointCoordsS.length !== 2 * p || p === 0) {
      throw new Error(`runHead: need 2 coordinates per label and at least one point`);
    }
    if (maskInput !== null && maskInput.length !== m * m) {
      throw new Error(`runHead: mask input must have ${m * m} values`);
    }
    const out = await runGraph(
      sessions.samHead,
      {
        image_embed: f32(feats.imageEmbed, [1, 256, g, g]),
        high_res_feat_s0: f32(feats.highResS0, [1, 32, 4 * g, 4 * g]),
        high_res_feat_s1: f32(feats.highResS1, [1, 64, 2 * g, 2 * g]),
        point_coords: f32(Float32Array.from(pointCoordsS), [1, p, 2]),
        point_labels: i32(Int32Array.from(labels), [1, p]),
        mask_input: f32(maskInput ?? new Float32Array(m * m), [1, 1, m, m]),
        has_mask_input: f32(Float32Array.of(maskInput === null ? 0 : 1), [1])
      },
      timings,
      "sam_head"
    );
    return {
      masks: out["masks"],
      ious: out["iou_predictions"],
      tokens: out["sam_tokens"],
      score: out["object_score_logits"][0],
      maskSize: m
    };
  }
  function stabilityScore(logits, delta) {
    let inter = 0;
    let union = 0;
    for (let i = 0; i < logits.length; i++) {
      const v = logits[i];
      if (v > delta) inter++;
      if (v > -delta) union++;
    }
    return union === 0 ? 1 : Math.fround(inter / union);
  }
  function selectOutput(masks, ious, tokens, score, numPoints, consts) {
    const area = masks.length / NUM_TOKENS;
    const dim = tokens.length / NUM_TOKENS;
    const mask = (k) => masks.subarray(k * area, (k + 1) * area);
    const token = (k) => tokens.subarray(k * dim, (k + 1) * dim);
    let best = 1;
    for (let k = 2; k < NUM_TOKENS; k++) {
      if (ious[k] > ious[best]) best = k;
    }
    const multimask = consts.multimask_min_pt_num <= numPoints && numPoints <= consts.multimask_max_pt_num;
    let index;
    let tokenIndex;
    if (multimask) {
      index = best;
      tokenIndex = best;
    } else {
      const stable = stabilityScore(mask(0), consts.stability_delta) >= consts.stability_thresh;
      index = stable ? 0 : best;
      tokenIndex = 0;
    }
    const lowRes = score > 0 ? mask(index).slice() : new Float32Array(area).fill(consts.no_obj_score);
    return {
      lowRes,
      iou: ious[index],
      score,
      token: token(tokenIndex),
      index,
      multimask,
      candidates: [
        { mask: mask(1), iou: ious[1] },
        { mask: mask(2), iou: ious[2] },
        { mask: mask(3), iou: ious[3] }
      ]
    };
  }
  function clampMaskInput(lowRes, clamp) {
    const out = new Float32Array(lowRes.length);
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.max(-clamp, Math.min(clamp, lowRes[i]));
    }
    return out;
  }

  // src/imagePredictor.ts
  var ImagePredictor = class {
    constructor(sessions, consts) {
      this.sessions = sessions;
      this.consts = consts;
    }
    timings = {};
    #feats = null;
    get hasImage() {
      return this.#feats !== null;
    }
    /** Encode a normalised `[3, S, S]` image (see `normalize`). */
    async setImage(input) {
      this.#feats = null;
      this.#feats = await encodeImage(this.sessions, input, this.consts.image_size, this.timings);
    }
    /**
     * Decode one prompt. A box becomes two leading points labelled 2 and 3; with no
     * points and no box a single padding point is passed (mask-only or empty prompt).
     * `maskInput` is a previous `lowRes` output; it is clamped to +-`mask_input_clamp`.
     */
    async predict(points, labels, box, maskInput) {
      const feats = this.#feats;
      if (feats === null) throw new Error("ImagePredictor: call setImage first");
      if (points.length !== labels.length) {
        throw new Error("ImagePredictor: one label per point");
      }
      const coords = [];
      const labs = [];
      if (box !== void 0) {
        coords.push(box.x0, box.y0, box.x1, box.y1);
        labs.push(2, 3);
      }
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        coords.push(p.x, p.y);
        labs.push(labels[i]);
      }
      const numPoints = labs.length;
      if (numPoints === 0) {
        coords.push(0, 0);
        labs.push(LABEL_PAD);
      }
      const mask = maskInput === void 0 ? null : clampMaskInput(maskInput, this.consts.mask_input_clamp);
      const raw = await runHead(this.sessions, feats, coords, labs, mask, this.timings);
      const sel = selectOutput(raw.masks, raw.ious, raw.tokens, raw.score, numPoints, this.consts);
      return { ...sel, raw };
    }
  };

  // src/videoTracker.ts
  var floorDiv = (a, b) => Math.floor(a / b);
  var LABEL_BOX_TL = 2;
  var LABEL_BOX_BR = 3;
  var MASK_SCALE = 20;
  var MASK_BIAS = -10;
  var FrameEncoder = class {
    constructor(sessions, consts, frames, opts = {}) {
      this.sessions = sessions;
      this.consts = consts;
      this.frames = frames;
      this.numFrames = frames.count;
      this.size = consts.image_size;
      this.timings = opts.timings ?? {};
      this.#cache = opts.cacheAll === true ? /* @__PURE__ */ new Map() : null;
    }
    timings;
    numFrames;
    size;
    #last = null;
    #cache;
    async features(frame) {
      const cached = this.#cache?.get(frame);
      if (cached !== void 0) return cached;
      if (this.#last !== null && this.#last.frame === frame) return this.#last.feats;
      if (!(frame >= 0 && frame < this.numFrames)) throw new Error(`frame ${frame} out of range`);
      const input = await this.frames.get(frame);
      const enc = await encodeImage(this.sessions, input, this.size, this.timings);
      const feats = withMemoryTokens(enc, this.consts);
      this.#last = { frame, feats };
      this.#cache?.set(frame, feats);
      return feats;
    }
    /** Drop the cached features. */
    clear() {
      this.#last = null;
      this.#cache?.clear();
    }
  };
  var VideoTracker = class {
    constructor(sessions, consts, frames, videoSize, opts = {}) {
      this.sessions = sessions;
      this.consts = consts;
      this.videoSize = videoSize;
      this.numFrames = frames.count;
      this.size = consts.image_size;
      this.grid = consts.embed_grid;
      if (opts.encoder !== void 0 && opts.encoder.numFrames !== frames.count) {
        throw new Error("VideoTracker: the shared encoder belongs to a clip of another length");
      }
      this.#encoder = opts.encoder ?? new FrameEncoder(sessions, consts, frames, { cacheAll: opts.cacheAll, timings: this.timings });
      this.#bf16 = opts.bf16Memory ?? true;
    }
    timings = {};
    /** Wall-clock ms of each tracked frame, excluding the image encoder. */
    frameTimes = [];
    numFrames;
    size;
    grid;
    #cond = /* @__PURE__ */ new Map();
    #nonCond = /* @__PURE__ */ new Map();
    #pending = /* @__PURE__ */ new Map();
    /** frame -> reverse flag of its last tracking. */
    #tracked = /* @__PURE__ */ new Map();
    #maskmemPos = null;
    // [HW, 64] tokens, cached once
    #encoder;
    #bf16;
    #busy = false;
    // ------------------------------------------------------------------ step 1: encode
    /** Encode once per frame (one-frame cache, plus the full cache when enabled). */
    features(frame) {
      return this.#encoder.features(frame);
    }
    // ------------------------------------------------------------------ step 2: SAM head
    /** Head graph + output selection + object pointer. */
    async samHead(imageEmbed, feats, coords, labels, maskInput) {
      const head = await runHead(
        this.sessions,
        { ...feats, imageEmbed },
        coords,
        labels,
        maskInput,
        this.timings
      );
      let numPoints = 0;
      for (let i = 0; i < labels.length; i++) if (labels[i] !== LABEL_PAD) numPoints++;
      const sel = selectOutput(head.masks, head.ious, head.tokens, head.score, numPoints, this.consts);
      const ptr = await runGraph(
        this.sessions.objectPointer,
        {
          mask_token: f32(sel.token.slice(), [1, sel.token.length]),
          object_score_logits: f32(Float32Array.of(head.score), [1, 1])
        },
        this.timings,
        "object_pointer"
      );
      return {
        predMasks: sel.lowRes,
        objPtr: ptr["obj_ptr"],
        score: head.score,
        maskmemFeatures: null
      };
    }
    // ------------------------------------------------------------------ step 3: memory
    /** Memory encoder on the chosen mask; stores bfloat16 features in `out`. */
    async encodeMemory(frame, out, fromClicks) {
      const feats = await this.features(frame);
      const S = this.size;
      const g = this.grid;
      const m = this.consts.mask_size;
      const highRes = upsampleBilinear(out.predMasks, m, S);
      const mem = await runGraph(
        this.sessions.memoryEncoder,
        {
          vision_feat: f32(feats.visionFeat, [1, this.consts.hidden_dim, g, g]),
          mask_logits: f32(highRes, [1, 1, S, S]),
          object_score_logits: f32(Float32Array.of(out.score), [1, 1]),
          binarize: f32(Float32Array.of(fromClicks ? 1 : 0), [1])
        },
        this.timings,
        "memory_encoder"
      );
      const features = mem["maskmem_features"];
      out.maskmemFeatures = this.#bf16 ? roundBf16(features) : features;
      if (this.#maskmemPos === null) {
        this.#maskmemPos = transpose(mem["maskmem_pos_enc"], this.consts.mem_dim);
      }
    }
    async ptrPos(tDiffs, maxPtrs) {
      const out = await runGraph(
        this.sessions.objectPointerTpos,
        {
          t_diff: f32(Float32Array.from(tDiffs), [tDiffs.length]),
          t_diff_max: f32(Float32Array.of(maxPtrs - 1), [1])
        },
        this.timings,
        "object_pointer_tpos"
      );
      return out["ptr_pos"];
    }
    /** The `memory` / `memory_pos` / `num_obj_ptr_tokens` the memory attention takes. */
    async memoryBank(frame, reverse) {
      const c = this.consts;
      const nMem = c.num_maskmem;
      const stride = c.memory_temporal_stride_for_eval;
      const dim = c.mem_dim;
      const [selected, unselected] = selectClosestCondFrames(
        frame,
        this.#cond,
        c.max_cond_frames_in_attn
      );
      const slots = [];
      for (const out of selected.values()) slots.push({ tPos: 0, out });
      for (let tPos = 1; tPos < nMem; tPos++) {
        const tRel = nMem - tPos;
        let prev;
        if (tRel === 1) prev = reverse ? frame + 1 : frame - 1;
        else if (reverse) prev = -floorDiv(-(frame + 2), stride) * stride + (tRel - 2) * stride;
        else prev = floorDiv(frame - 2, stride) * stride - (tRel - 2) * stride;
        slots.push({ tPos, out: this.#nonCond.get(prev) ?? unselected.get(prev) });
      }
      const pos = this.#maskmemPos;
      if (pos === null) throw new Error("memoryBank: no memory encoded yet");
      const hw = pos.length / dim;
      const spatial = [];
      for (const { tPos, out } of slots) {
        if (out === void 0 || out.maskmemFeatures === null) continue;
        spatial.push({
          feats: out.maskmemFeatures,
          tpos: c.maskmem_tpos_enc[nMem - tPos - 1]
        });
      }
      const maxPtrs = Math.min(this.numFrames, c.max_obj_ptrs_in_encoder);
      const sign = reverse ? -1 : 1;
      const ptrs = [];
      for (const [t, o] of selected) {
        if (c.only_obj_ptrs_in_the_past_for_eval && !(reverse ? t >= frame : t <= frame)) continue;
        ptrs.push({ dist: (frame - t) * sign, ptr: o.objPtr });
      }
      for (let tDiff = 1; tDiff < maxPtrs; tDiff++) {
        const t = reverse ? frame + tDiff : frame - tDiff;
        if (t < 0 || t >= this.numFrames) break;
        const out = this.#nonCond.get(t) ?? unselected.get(t);
        if (out !== void 0) ptrs.push({ dist: tDiff, ptr: out.objPtr });
      }
      const split = c.tokens_per_obj_ptr;
      const numPtrTokens = split * ptrs.length;
      const numTokens = spatial.length * hw + numPtrTokens;
      const memory = new Float32Array(numTokens * dim);
      const memoryPos = new Float32Array(numTokens * dim);
      let row = 0;
      for (const { feats, tpos } of spatial) {
        for (let t = 0; t < hw; t++) {
          const o = (row + t) * dim;
          for (let ch = 0; ch < dim; ch++) {
            memory[o + ch] = feats[ch * hw + t];
            memoryPos[o + ch] = pos[t * dim + ch] + tpos[ch];
          }
        }
        row += hw;
      }
      if (ptrs.length > 0) {
        const ptrPos = await this.ptrPos(
          ptrs.map((p) => p.dist),
          maxPtrs
        );
        ptrs.forEach(({ ptr }, k) => {
          for (let i = 0; i < split; i++) {
            const o = (row + i) * dim;
            memory.set(ptr.subarray(i * dim, (i + 1) * dim), o);
            memoryPos.set(ptrPos.subarray(k * dim, (k + 1) * dim), o);
          }
          row += split;
        });
      }
      return { memory, memoryPos, numTokens, numPtrTokens };
    }
    /** The SAM head's `image_embed` for this frame: raw encoder output, or memory-conditioned. */
    async condition(frame, isInit, reverse) {
      const feats = await this.features(frame);
      if (isInit) return feats.imageEmbed;
      const bank = await this.memoryBank(frame, reverse);
      const dim = this.consts.mem_dim;
      const hw = this.grid * this.grid;
      const out = await runGraph(
        this.sessions.memoryAttention,
        {
          curr: f32(feats.curr, [1, hw, this.consts.hidden_dim]),
          memory: f32(bank.memory, [1, bank.numTokens, dim]),
          memory_pos: f32(bank.memoryPos, [1, bank.numTokens, dim]),
          num_obj_ptr_tokens: i64(BigInt64Array.of(BigInt(bank.numPtrTokens)), [1])
        },
        this.timings,
        "memory_attention"
      );
      return out["image_embed"];
    }
    // ------------------------------------------------------------------ prompts / propagate
    /**
     * Clicks and/or a box on `frame` (replacing earlier prompts there); points and box in
     * video pixels, labels 1 positive / 0 negative. The box becomes two leading points
     * labelled 2 and 3 (so a box alone is a single-mask call). A frame that was tracked
     * before is a correction, conditioned on memory in the direction it was last tracked.
     * Returns the frame's new prediction.
     */
    async addClick(frame, points, labels, box) {
      if (points.length !== labels.length) throw new Error("addClick: one label per point");
      if (points.length === 0 && box === void 0) {
        throw new Error("addClick: need at least one point or a box");
      }
      this.#enter();
      try {
        const f2 = Math.fround;
        const S = f2(this.size);
        const { width: w, height: h } = this.videoSize;
        const xy = [];
        const labs = [];
        if (box !== void 0) {
          xy.push(box.x0, box.y0, box.x1, box.y1);
          labs.push(LABEL_BOX_TL, LABEL_BOX_BR);
        }
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          xy.push(p.x, p.y);
          labs.push(labels[i]);
        }
        const coords = new Float32Array(xy.length);
        for (let i = 0; i < xy.length; i += 2) {
          coords[i] = f2(f2(xy[i]) / f2(w)) * S;
          coords[i + 1] = f2(f2(xy[i + 1]) / f2(h)) * S;
        }
        const prior = this.#pending.get(frame) ?? this.#cond.get(frame) ?? this.#nonCond.get(frame);
        const maskInput = prior === void 0 ? null : clampMaskInput(prior.predMasks, this.consts.mask_input_clamp);
        const isInit = !this.#tracked.has(frame);
        const reverse = isInit ? false : this.#tracked.get(frame);
        const embed = await this.condition(frame, isInit, reverse);
        const out = await this.samHead(embed, await this.features(frame), coords, labs, maskInput);
        this.#pending.set(frame, out);
        return { lowRes: out.predMasks, score: out.score };
      } finally {
        this.#busy = false;
      }
    }
    /**
     * A mask prompt on `frame` (`VideoPredictor.add_mask` / `SAM2.mask_as_output`): the
     * binary mask is taken as the frame's prediction instead of being re-predicted, and
     * replaces any clicks there. `mask` holds one value per pixel, row-major, foreground
     * where `> 0` (so low-res logits, a video-resolution mask or 0/1 bytes all work); `size`
     * is its height and width, or omitted for a square mask. Any size: it is resized to
     * S x S (antialiased bilinear, threshold 0.5). The low-res logits are `mask * 20 - 10`
     * antialias-downsampled by 4, the score is 10 (any pixel set) or -10, and the SAM head
     * runs only for the object pointer, with the mask (through the learned stride-4 conv) as
     * its dense prompt and no points; an empty mask gets the learned no-object pointer. The
     * memory is not consulted, even on a frame that was already tracked.
     */
    async addMask(frame, mask, size) {
      const side = Math.round(Math.sqrt(mask.length));
      const h = size?.height ?? side;
      const w = size?.width ?? side;
      if (mask.length !== h * w || h <= 0 || w <= 0) {
        throw new Error(`addMask: ${mask.length} values do not form a ${h} x ${w} mask`);
      }
      this.#enter();
      try {
        const S = this.size;
        const c = this.consts;
        const binary = new Float32Array(h * w);
        for (let i = 0; i < binary.length; i++) binary[i] = mask[i] > 0 ? 1 : 0;
        let m = binary;
        if (h !== S || w !== S) {
          const soft = resizeAntialias(binary, { height: h, width: w }, S);
          m = new Float32Array(S * S);
          for (let i = 0; i < m.length; i++) m[i] = soft[i] >= 0.5 ? 1 : 0;
        }
        let isObj = false;
        const highRes = new Float32Array(S * S);
        for (let i = 0; i < m.length; i++) {
          if (m[i] > 0) isObj = true;
          highRes[i] = m[i] * MASK_SCALE + MASK_BIAS;
        }
        const lowRes = resizeAntialias(highRes, S, c.mask_size);
        const feats = await this.features(frame);
        const head = await runHead(
          this.sessions,
          feats,
          [0, 0],
          [LABEL_PAD],
          maskDownsample(m, S, c.mask_downsample_weight, c.mask_downsample_bias),
          this.timings
        );
        let objPtr;
        if (isObj) {
          const dim = head.tokens.length / 4;
          const ptr = await runGraph(
            this.sessions.objectPointer,
            {
              mask_token: f32(head.tokens.slice(0, dim), [1, dim]),
              object_score_logits: f32(Float32Array.of(head.score), [1, 1])
            },
            this.timings,
            "object_pointer"
          );
          objPtr = ptr["obj_ptr"];
        } else {
          objPtr = c.no_obj_ptr.slice();
        }
        const score = isObj ? MASK_SCALE + MASK_BIAS : MASK_BIAS;
        this.#pending.set(frame, { predMasks: lowRes, objPtr, score, maskmemFeatures: null });
        return { lowRes, score };
      } finally {
        this.#busy = false;
      }
    }
    /** Encode prompted frames into memory and make them conditioning frames. */
    async preflight() {
      const frames = [...this.#pending.keys()].sort((a, b) => a - b);
      for (const frame of frames) {
        const out = this.#pending.get(frame);
        if (out.maskmemFeatures === null) await this.encodeMemory(frame, out, true);
        this.#cond.set(frame, out);
        this.#nonCond.delete(frame);
      }
      this.#pending.clear();
      if (this.#cond.size === 0) throw new Error("add a prompt before propagating");
    }
    /**
     * Track from `start` (default: the first conditioning frame) to the clip end in one
     * direction. Conditioning frames are yielded with their stored prediction.
     */
    async *propagate(start, reverse = false) {
      this.#enter();
      try {
        await this.preflight();
        const first = start ?? Math.min(...this.#cond.keys());
        const step = reverse ? -1 : 1;
        for (let frame = first; reverse ? frame >= 0 : frame < this.numFrames; frame += step) {
          let out = this.#cond.get(frame);
          const isConditioning = out !== void 0;
          let took = 0;
          if (out === void 0) {
            const feats = await this.features(frame);
            const t0 = performance.now();
            const embed = await this.condition(frame, false, reverse);
            out = await this.samHead(embed, feats, [0, 0], [LABEL_PAD], null);
            await this.encodeMemory(frame, out, false);
            this.#nonCond.set(frame, out);
            took = performance.now() - t0;
            this.frameTimes.push(took);
          }
          this.#tracked.set(frame, reverse);
          yield { frame, lowRes: out.predMasks, score: out.score, isConditioning, ms: took };
        }
      } finally {
        this.#busy = false;
      }
    }
    /** The latest prediction stored for a frame (clicked, conditioning or tracked), if any. */
    prediction(frame) {
      const pending = this.#pending.get(frame);
      const cond = this.#cond.get(frame);
      const out = pending ?? cond ?? this.#nonCond.get(frame);
      if (out === void 0) return null;
      return {
        frame,
        lowRes: out.predMasks,
        score: out.score,
        isConditioning: pending !== void 0 || cond !== void 0,
        ms: 0
      };
    }
    /** Prompted frames (conditioning frames plus prompts not yet propagated), ascending. */
    get promptedFrames() {
      return [.../* @__PURE__ */ new Set([...this.#cond.keys(), ...this.#pending.keys()])].sort((a, b) => a - b);
    }
    get hasPrompts() {
      return this.#cond.size > 0 || this.#pending.size > 0;
    }
    get busy() {
      return this.#busy;
    }
    /** Forget every prompt and memory (keeps the encoder cache). */
    reset() {
      if (this.#busy) throw new Error("VideoTracker: busy");
      this.#cond.clear();
      this.#nonCond.clear();
      this.#pending.clear();
      this.#tracked.clear();
    }
    #enter() {
      if (this.#busy) throw new Error("VideoTracker: a click or propagation is already running");
      this.#busy = true;
    }
  };
  function transpose(x, channels) {
    const hw = x.length / channels;
    const out = new Float32Array(x.length);
    for (let c = 0; c < channels; c++) {
      for (let t = 0; t < hw; t++) out[t * channels + c] = x[c * hw + t];
    }
    return out;
  }
  function selectClosestCondFrames(frame, cond, maxCondFrames) {
    if (maxCondFrames === -1 || cond.size <= maxCondFrames) return [new Map(cond), /* @__PURE__ */ new Map()];
    const keys = [...cond.keys()];
    const chosen = [];
    const before = keys.filter((t) => t < frame);
    if (before.length > 0) chosen.push(Math.max(...before));
    const after = keys.filter((t) => t >= frame);
    if (after.length > 0) chosen.push(Math.min(...after));
    const rest = keys.filter((t) => !chosen.includes(t)).sort((a, b) => Math.abs(a - frame) - Math.abs(b - frame));
    chosen.push(...rest.slice(0, maxCondFrames - chosen.length));
    const selected = /* @__PURE__ */ new Map();
    for (const t of chosen) selected.set(t, cond.get(t));
    const unselected = /* @__PURE__ */ new Map();
    for (const [t, v] of cond) if (!selected.has(t)) unselected.set(t, v);
    return [selected, unselected];
  }

  // src/multiObjectTracker.ts
  var NON_OVERLAP_CLAMP = -10;
  var MultiObjectTracker = class {
    constructor(sessions, consts, frames, videoSize, opts = {}) {
      this.sessions = sessions;
      this.consts = consts;
      this.frames = frames;
      this.videoSize = videoSize;
      this.numFrames = frames.count;
      this.encoder = new FrameEncoder(sessions, consts, frames, { cacheAll: opts.cacheAll, timings: this.timings });
      this.#opts = { bf16Memory: opts.bf16Memory, encoder: this.encoder };
    }
    /** Shared `image_encoder` timings; each object's other graphs are timed on its tracker. */
    timings = {};
    encoder;
    numFrames;
    #objects = /* @__PURE__ */ new Map();
    #opts;
    #nextId = 1;
    #busy = false;
    // ------------------------------------------------------------------ objects
    /** Create an object (an empty memory bank) and return its id (1, 2, ...). */
    addObject() {
      const id = this.#nextId++;
      this.#objects.set(id, new VideoTracker(this.sessions, this.consts, this.frames, this.videoSize, this.#opts));
      return id;
    }
    /** Drop an object and everything it remembers. */
    removeObject(id) {
      this.#check();
      if (!this.#objects.delete(id)) throw new Error(`MultiObjectTracker: no object ${id}`);
    }
    /** Forget an object's clicks and memory; it stays in the list. */
    clearObject(id) {
      this.#check();
      this.#object(id).reset();
    }
    /** Object ids in creation order. */
    get objectIds() {
      return [...this.#objects.keys()];
    }
    /** The object's own tracker: its timings, frame times and stored predictions. */
    object(id) {
      return this.#object(id);
    }
    hasPrompts(id) {
      return this.#object(id).hasPrompts;
    }
    // ------------------------------------------------------------------ prompts / propagate
    /** Clicks and/or a box for one object on `frame`: see `VideoTracker.addClick`. */
    async addClick(objId, frame, points, labels, box) {
      const tracker = this.#object(objId);
      this.#enter();
      try {
        return await tracker.addClick(frame, points, labels, box);
      } finally {
        this.#busy = false;
      }
    }
    /** A mask prompt for one object on `frame`: see `VideoTracker.addMask`. */
    async addMask(objId, frame, mask, size) {
      const tracker = this.#object(objId);
      this.#enter();
      try {
        return await tracker.addMask(frame, mask, size);
      } finally {
        this.#busy = false;
      }
    }
    /**
     * Track every prompted object from `start` (default: the first prompted frame over all of
     * them) to the clip end in one direction, frame by frame, so each frame is encoded once
     * and every object steps on it before the next frame is touched. Objects without prompts
     * are skipped.
     */
    async *propagate(start, reverse = false) {
      this.#enter();
      const gens = [];
      try {
        const prompted = [...this.#objects].filter(([, t]) => t.hasPrompts);
        if (prompted.length === 0) throw new Error("add a prompt before propagating");
        const first = start ?? Math.min(...prompted.map(([, t]) => t.promptedFrames[0]));
        for (const [id, t] of prompted) gens.push([id, t.propagate(first, reverse)]);
        for (; ; ) {
          const before = this.timings["image_encoder"]?.length ?? 0;
          const perObject = /* @__PURE__ */ new Map();
          let frame = -1;
          for (const [id, gen] of gens) {
            const r = await gen.next();
            if (r.done === true) break;
            const { lowRes, score, isConditioning, ms } = r.value;
            frame = r.value.frame;
            perObject.set(id, { lowRes, score, isConditioning, ms });
          }
          if (perObject.size < gens.length) break;
          const enc = this.timings["image_encoder"] ?? [];
          let encoderMs = 0;
          for (let i = before; i < enc.length; i++) encoderMs += enc[i];
          yield { frame, perObject, encoderMs };
        }
      } finally {
        for (const [, gen] of gens) await gen.return(void 0);
        this.#busy = false;
      }
    }
    /** The latest prediction stored for each object on a frame (objects without one are absent). */
    prediction(frame) {
      const out = /* @__PURE__ */ new Map();
      for (const [id, t] of this.#objects) {
        const p = t.prediction(frame);
        if (p !== null) out.set(id, p);
      }
      return out;
    }
    /** Forget every object's clicks and memory; the objects stay (the encoder cache too). */
    reset() {
      this.#check();
      for (const t of this.#objects.values()) t.reset();
    }
    #object(id) {
      const t = this.#objects.get(id);
      if (t === void 0) throw new Error(`MultiObjectTracker: no object ${id}`);
      return t;
    }
    #check() {
      if (this.#busy) throw new Error("MultiObjectTracker: busy");
    }
    #enter() {
      this.#check();
      this.#busy = true;
    }
  };
  function nonOverlapping(logitsByObject) {
    const ids = [...logitsByObject.keys()];
    const out = /* @__PURE__ */ new Map();
    if (ids.length <= 1) {
      for (const id of ids) out.set(id, logitsByObject.get(id));
      return out;
    }
    const maps = ids.map((id) => logitsByObject.get(id));
    const n = maps[0].length;
    for (const m of maps) if (m.length !== n) throw new Error("nonOverlapping: objects differ in mask size");
    const result = maps.map((m) => new Float32Array(m.length));
    for (let i = 0; i < n; i++) {
      let winner = 0;
      let best = maps[0][i];
      for (let k = 1; k < maps.length; k++) {
        const v = maps[k][i];
        if (v > best) {
          best = v;
          winner = k;
        }
      }
      for (let k = 0; k < maps.length; k++) {
        const v = maps[k][i];
        result[k][i] = k === winner ? v : Math.min(v, NON_OVERLAP_CLAMP);
      }
    }
    ids.forEach((id, k) => out.set(id, result[k]));
    return out;
  }

  // src/browser.ts
  function resizeToSquare(source, S) {
    let ctx;
    if (typeof OffscreenCanvas !== "undefined") {
      ctx = new OffscreenCanvas(S, S).getContext("2d", { willReadFrequently: true });
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = S;
      canvas.height = S;
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (ctx === null) throw new Error("resizeToSquare: no 2D canvas context");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, S, S);
    return ctx.getImageData(0, 0, S, S).data;
  }
  async function requestAdapter() {
    const gpu = globalThis.navigator?.gpu;
    if (gpu === void 0) return null;
    try {
      return await gpu.requestAdapter();
    } catch {
      return null;
    }
  }
  async function pickProvider() {
    return await requestAdapter() ? "webgpu" : "wasm";
  }
  async function supportsShaderF16() {
    return (await requestAdapter())?.features?.has("shader-f16") === true;
  }
  function configureOrt(ort, version) {
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/`;
    ort.env.wasm.numThreads = 1;
    setOrt(ort);
  }
  function fetchLoader(baseUrl, sizes) {
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return async (file, onProgress) => {
      const res = await fetch(base + file);
      if (!res.ok || res.body === null) throw new Error(`Could not download ${file} (${res.status})`);
      const total = sizes?.[file] ?? (Number(res.headers.get("content-length")) || 0);
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        if (total > 0) onProgress?.(Math.min(got / total, 1));
      }
      const buf = new Uint8Array(got);
      let off = 0;
      for (const c of chunks) {
        buf.set(c, off);
        off += c.length;
      }
      return buf;
    };
  }
  function maskToImageData(lowRes, m, width, height, color) {
    const logits = upsampleBilinear(lowRes, m, { height, width });
    const rgba = new Uint8ClampedArray(width * height * 4);
    const [r, g, b, a] = color;
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > 0) {
        const o = i * 4;
        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = b;
        rgba[o + 3] = a;
      }
    }
    return new ImageData(rgba, width, height);
  }
  return __toCommonJS(src_exports);
})();
