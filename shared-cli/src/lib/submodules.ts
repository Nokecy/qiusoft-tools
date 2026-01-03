export type SubmoduleInfo = {
  name: string;
  path: string;
  url: string;
};

const SUBMODULES: SubmoduleInfo[] = [
  {
    name: 'appSYS',
    path: 'src/pages/appSYS',
    url: 'https://cnb.cool/qc_software/sub_common/web_appSys',
  },
  {
    name: 'appMES',
    path: 'src/pages/appMES',
    url: 'https://cnb.cool/qc_software/sub_common/web_MES',
  },
  {
    name: 'appWMS',
    path: 'src/pages/appWMS',
    url: 'https://cnb.cool/qc_software/sub_common/web_WMS',
  },
  {
    name: 'appPDM',
    path: 'src/pages/appPDM',
    url: 'https://cnb.cool/qc_software/sub_common/web_pdm',
  },
  {
    name: 'appWorkflow',
    path: 'src/pages/appWorkflow',
    url: 'https://cnb.cool/qc_software/sub_common/web_workflow',
  },
  {
    name: 'appTMS',
    path: 'src/pages/appTMS',
    url: 'https://cnb.cool/qc_software/sub_common/web_TMS',
  },
  {
    name: 'appCommon',
    path: 'src/pages/appCommon',
    url: 'https://cnb.cool/qc_software/sub_common/sub_web_erpCommon',
  },
];

export function listSubmodules(): SubmoduleInfo[] {
  return [...SUBMODULES];
}

export function resolveSubmodules(names: string[]): SubmoduleInfo[] {
  const map = new Map(SUBMODULES.map(item => [normalizeName(item.name), item]));
  const result: SubmoduleInfo[] = [];
  const unknown: string[] = [];
  for (const name of names) {
    const key = normalizeName(name);
    const found = map.get(key);
    if (!found) {
      unknown.push(name);
      continue;
    }
    if (!result.find(item => item.name === found.name)) {
      result.push(found);
    }
  }
  if (unknown.length > 0) {
    const available = SUBMODULES.map(item => item.name).join(', ');
    throw new Error(`未知子库: ${unknown.join(', ')}。可选: ${available}`);
  }
  return result;
}

function normalizeName(name: string) {
  return name.replace(/\s+/g, '').toLowerCase();
}
