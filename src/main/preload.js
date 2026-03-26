const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 员工相关
  getEmployees: () => ipcRenderer.invoke('get-employees'),
  getEmployeesFull: () => ipcRenderer.invoke('get-employees-full'),
  getEmployeeDetail: (oaNumber) => ipcRenderer.invoke('get-employee-detail', oaNumber),
  searchEmployees: (keyword) => ipcRenderer.invoke('search-employees', keyword),
  updateEmployeeRemark: (data) => ipcRenderer.invoke('update-employee-remark', data),

  // 统计相关
  getStatistics: () => ipcRenderer.invoke('get-statistics'),
  getUnpassEmployees: () => ipcRenderer.invoke('get-unpass-employees'),
  getPassEmployees: () => ipcRenderer.invoke('get-pass-employees'),

  // 岗位相关
  getPositions: () => ipcRenderer.invoke('get-positions'),
  importPositions: (data) => ipcRenderer.invoke('import-positions', data),
  savePosition: (data) => ipcRenderer.invoke('save-position', data),
  deletePosition: (id) => ipcRenderer.invoke('delete-position', id),

  // 导入相关
  importEmployeeTransfer: (data) => ipcRenderer.invoke('import-employee-transfer', data),
  importCertificates: (data) => ipcRenderer.invoke('import-certificates', data),
  importContinueEdu: (data) => ipcRenderer.invoke('import-continue-edu', data),

  // 文件操作
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  readExcel: (filePath) => ipcRenderer.invoke('read-excel', filePath),
  exportExcel: (data) => ipcRenderer.invoke('export-excel', data),

  // 数据库操作
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),

  // 证书名称
  getAllCertNames: () => ipcRenderer.invoke('get-all-cert-names')
})
