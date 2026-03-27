#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../../..");
const defaultSamplesDir = path.join(repoRoot, "samples");
const defaultDataset = path.join(
  defaultSamplesDir,
  "辐射站-测试表单还原流程-流程-样品-检测项目-数据源.json"
);

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const datasetMode = args.has("--dataset");

function fileExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function listSampleDirs(samplesDir) {
  return fs
    .readdirSync(samplesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function findScriptFile(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((name) => /\.js$/i.test(name))
    .sort()[0];
}

function analyzeScript(text) {
  return {
    returnKind: /\nformJs\s*;?\s*$/.test(text)
      ? "formJs"
      : /\nreports\s*;?\s*$/.test(text)
        ? "single-object"
        : /\noutputData\s*;?\s*$/.test(text)
          ? "array"
          : "unknown",
    usesGetForm: /\bgetForm\s*\(/.test(text),
    usesGetSignUrl: /\bgetSignUrl\s*\(/.test(text),
    usesPartData: /function\s+partData\s*\(/.test(text),
    usesGaugingData: /function\s+gaugingData\s*\(/.test(text),
    usesObjAssign: /function\s+ObjAssign\s*\(/.test(text),
    usesGetValue: /function\s+getValue\s*\(/.test(text),
    usesArrow: /=>/.test(text),
    usesConst: /\bconst\b/.test(text),
    filtersTempId: /tempId\s*===/.test(text),
    filtersVersion: /\bt_version\b/.test(text),
    filtersTemplateName: /\bgaugingTemplateName\b/.test(text),
    groupsBySigner: /findKey\s*=/.test(text),
    groupsBySite:
      /uniqueChangSuo/.test(text) ||
      /indexOf\(itm\.t_changSuo\)/.test(text) ||
      /data\.t_changSuo\s*===\s*itm\.t_changSuo/.test(text),
    groupsByCustom: /\bgroupBy\s*\(/.test(text),
    padsRows: /push\(\{\}\)/.test(text) && /remainder/.test(text),
    sorts: /sortArrObjBySingleKey|localeCompare/.test(text),
    usesHardcodedOss: /oss\/lab/.test(text),
  };
}

function summarizeReports(samplesDir) {
  return listSampleDirs(samplesDir).map((dirName) => {
    const dirPath = path.join(samplesDir, dirName);
    const files = fs.readdirSync(dirPath).sort();
    const scriptFile = findScriptFile(dirPath);
    const markdownFiles = files.filter((name) => /\.md$/i.test(name));
    const imageFiles = files.filter((name) => /\.png$/i.test(name));
    const text = scriptFile
      ? fs.readFileSync(path.join(dirPath, scriptFile), "utf8")
      : "";
    return {
      dirName,
      scriptFile,
      markdownFiles,
      imageFiles,
      ...analyzeScript(text),
    };
  });
}

function getType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function summarizeDataset(datasetPath) {
  const data = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
  const formJs = data.formJs || {};
  const samplesJs = data.samplesJs || [];
  const allGauging = samplesJs.flatMap((sample) => sample.gaugingTableList || []);

  function firstMatching(predicate) {
    return allGauging.find(predicate) || null;
  }

  function firstObjectField(fieldName) {
    for (const item of allGauging) {
      const value = item ? item[fieldName] : null;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
      }
    }
    return null;
  }

  return {
    datasetPath,
    topLevelKeys: Object.keys(data),
    formKeyCount: Object.keys(formJs).length,
    formKeysPreview: Object.keys(formJs).slice(0, 40),
    sampleCount: samplesJs.length,
    sampleKeyCount: samplesJs[0] ? Object.keys(samplesJs[0]).length : 0,
    sampleKeysPreview: samplesJs[0] ? Object.keys(samplesJs[0]).slice(0, 60) : [],
    gaugingCountsPerSample: samplesJs.map(
      (sample) => (sample.gaugingTableList || []).length
    ),
    gaugingCount: allGauging.length,
    gaugingTemplateNames: [
      ...new Set(allGauging.map((item) => item.gaugingTemplateName).filter(Boolean)),
    ],
    signatureShape: firstMatching((item) => Array.isArray(item.t_TestMan))?.t_TestMan || null,
    linkedCurveShape: firstObjectField("t_glQX") || firstObjectField("t_qx"),
    linkedInstrumentShape: firstObjectField("关联仪器"),
    sampleValueTypeHints: samplesJs[0]
      ? Object.keys(samplesJs[0])
          .slice(0, 40)
          .map((key) => ({ key, type: getType(samplesJs[0][key]) }))
      : [],
  };
}

function printReports(summary) {
  summary.forEach((item) => {
    console.log(`\n[${item.dirName}]`);
    console.log(`  script: ${item.scriptFile || "none"}`);
    console.log(`  return: ${item.returnKind}`);
    console.log(`  markdown: ${item.markdownFiles.join(", ") || "none"}`);
    console.log(`  images: ${item.imageFiles.length}`);
    console.log(
      `  filters: ${
        [
          item.filtersTempId && "tempId",
          item.filtersTemplateName && "gaugingTemplateName",
          item.filtersVersion && "t_version",
        ]
          .filter(Boolean)
          .join(", ") || "none"
      }`
    );
    console.log(
      `  grouping: ${
        [
          item.groupsBySigner && "signer-combo",
          item.groupsBySite && "site-field",
          item.groupsByCustom && "custom-groupBy",
        ]
          .filter(Boolean)
          .join(", ") || "none"
      }`
    );
    console.log(
      `  patterns: ${
        [
          item.usesGetForm && "getForm",
          item.usesGetSignUrl && "getSignUrl",
          item.usesPartData && "partData",
          item.usesGaugingData && "gaugingData",
          item.usesObjAssign && "ObjAssign",
          item.usesGetValue && "getValue",
          item.padsRows && "pad-rows",
          item.sorts && "sort",
          item.usesHardcodedOss && "hardcoded-oss",
          item.usesArrow && "arrow",
          item.usesConst && "const",
        ]
          .filter(Boolean)
          .join(", ") || "none"
      }`
    );
  });
}

function printDataset(summary) {
  function preview(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
      return {
        type: "array",
        length: value.length,
        first:
          value.length > 0
            ? typeof value[0] === "object" && value[0] !== null
              ? Object.keys(value[0]).slice(0, 12)
              : value[0]
            : null,
      };
    }
    if (typeof value === "object") {
      if (depth >= 1) {
        return { type: "object", keys: Object.keys(value).slice(0, 20) };
      }
      const out = {};
      for (const key of Object.keys(value).slice(0, 12)) {
        const child = value[key];
        out[key] =
          typeof child === "object" && child !== null ? preview(child, depth + 1) : child;
      }
      return out;
    }
    return value;
  }

  console.log(`dataset: ${summary.datasetPath}`);
  console.log(`top keys: ${summary.topLevelKeys.join(", ")}`);
  console.log(`formJs keys: ${summary.formKeyCount}`);
  console.log(`samplesJs count: ${summary.sampleCount}`);
  console.log(`sample[0] keys: ${summary.sampleKeyCount}`);
  console.log(`gauging counts per sample: ${summary.gaugingCountsPerSample.join(", ")}`);
  console.log(`gauging total: ${summary.gaugingCount}`);
  console.log("gauging template names:");
  summary.gaugingTemplateNames.forEach((name) => console.log(`  - ${name}`));
  console.log("\nsignature shape:");
  console.log(JSON.stringify(preview(summary.signatureShape), null, 2));
  console.log("\nlinked curve shape:");
  console.log(JSON.stringify(preview(summary.linkedCurveShape), null, 2));
  console.log("\nlinked instrument shape:");
  console.log(JSON.stringify(preview(summary.linkedInstrumentShape), null, 2));
}

if (datasetMode) {
  if (!fileExists(defaultDataset)) {
    console.error(`dataset not found: ${defaultDataset}`);
    process.exit(1);
  }
  const summary = summarizeDataset(defaultDataset);
  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printDataset(summary);
  }
} else {
  if (!fileExists(defaultSamplesDir)) {
    console.error(`samples dir not found: ${defaultSamplesDir}`);
    process.exit(1);
  }
  const summary = summarizeReports(defaultSamplesDir);
  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printReports(summary);
  }
}
