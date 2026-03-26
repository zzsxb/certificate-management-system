const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const Database = require('better-sqlite3')
const fs = require('fs')

// 数据库实例
let db = null
let mainWindow = null

// 数据库文件路径
const dbPath = path.join(app.getPath('userData'), 'certificate.db')

/**
 * 初始化数据库
 */
function initDatabase() {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // 创建人员信息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      oa_number VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      ps_position VARCHAR(100),
      status VARCHAR(20) DEFAULT '在职',
      remark TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      update_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建证书明细表
  db.exec(`
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      oa_number VARCHAR(50) NOT NULL,
      cert_name VARCHAR(200) NOT NULL,
      obtain_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT '有效',
      invalid_date DATE,
      remark TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(oa_number, cert_name)
    )
  `)

  // 创建继续教育记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS continue_edu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      oa_number VARCHAR(50) NOT NULL,
      cert_name VARCHAR(200) NOT NULL,
      edu_year INTEGER NOT NULL,
      result VARCHAR(20) NOT NULL,
      remark TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建PS岗位表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ps_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position_name VARCHAR(100) UNIQUE NOT NULL,
      remark TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      update_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建岗位-证书映射表
  db.exec(`
    CREATE TABLE IF NOT EXISTS position_cert_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position_id INTEGER NOT NULL,
      cert_name VARCHAR(200) NOT NULL,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(position_id, cert_name),
      FOREIGN KEY (position_id) REFERENCES ps_positions(id)
    )
  `)

  // 创建人员变动历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS transfer_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      oa_number VARCHAR(50) NOT NULL,
      transfer_type VARCHAR(20) NOT NULL,
      old_position VARCHAR(100),
      new_position VARCHAR(100),
      remark TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建证书名称字典表
  db.exec(`
    CREATE TABLE IF NOT EXISTS cert_names (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      standard_name VARCHAR(200) UNIQUE NOT NULL,
      aliases TEXT,
      remark TEXT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_emp_name ON employees(name);
    CREATE INDEX IF NOT EXISTS idx_emp_status ON employees(status);
    CREATE INDEX IF NOT EXISTS idx_cert_oa ON certificates(oa_number);
    CREATE INDEX IF NOT EXISTS idx_cert_status ON certificates(status);
    CREATE INDEX IF NOT EXISTS idx_edu_oa ON continue_edu(oa_number);
    CREATE INDEX IF NOT EXISTS idx_edu_year ON continue_edu(edu_year);
    CREATE INDEX IF NOT EXISTS idx_transfer_oa ON transfer_history(oa_number);
  `)

  console.log('数据库初始化完成:', dbPath)
}

/**
 * 创建主窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../renderer/assets/icon.png'),
    title: '郑州分行持证上岗证书管理系统'
  })

  // 开发环境加载 vite 开发服务器
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:17432')
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境：__dirname 指向 app.asar 内的 src/main 目录
    // dist 在 app.asar 根目录下
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用就绪
app.whenReady().then(() => {
  initDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close()
    app.quit()
  }
})

// ==================== IPC 处理 ====================

// 获取所有在职员工
ipcMain.handle('get-employees', async () => {
  const stmt = db.prepare(`
    SELECT e.*,
      GROUP_CONCAT(DISTINCT CASE WHEN c.status = '有效' THEN c.cert_name END) as held_certs
    FROM employees e
    LEFT JOIN certificates c ON e.oa_number = c.oa_number
    WHERE e.status = '在职'
    GROUP BY e.oa_number
    ORDER BY e.oa_number
  `)
  return stmt.all()
})

// 获取员工详情
ipcMain.handle('get-employee-detail', async (event, oaNumber) => {
  const employee = db.prepare('SELECT * FROM employees WHERE oa_number = ?').get(oaNumber)
  if (!employee) return null

  // 获取有效证书
  const validCerts = db.prepare(`
    SELECT cert_name, obtain_date, create_time
    FROM certificates
    WHERE oa_number = ? AND status = '有效'
    ORDER BY obtain_date DESC
  `).all(oaNumber)

  // 获取失效证书
  const invalidCerts = db.prepare(`
    SELECT cert_name, obtain_date, invalid_date, create_time
    FROM certificates
    WHERE oa_number = ? AND status = '失效'
    ORDER BY invalid_date DESC
  `).all(oaNumber)

  // 获取继续教育历史
  const continueEdu = db.prepare(`
    SELECT cert_name, edu_year, result, create_time
    FROM continue_edu
    WHERE oa_number = ?
    ORDER BY edu_year DESC, create_time DESC
  `).all(oaNumber)

  // 获取变动历史
  const transferHistory = db.prepare(`
    SELECT transfer_type, old_position, new_position, remark, create_time
    FROM transfer_history
    WHERE oa_number = ?
    ORDER BY create_time DESC
  `).all(oaNumber)

  // 计算必考证书
  const requiredCerts = []
  if (employee.ps_position) {
    const certs = db.prepare(`
      SELECT m.cert_name
      FROM position_cert_map m
      JOIN ps_positions p ON m.position_id = p.id
      WHERE p.position_name = ?
    `).all(employee.ps_position)
    requiredCerts.push(...certs.map(c => c.cert_name))
  }

  // 计算应考未考证书
  const heldCertNames = validCerts.map(c => c.cert_name)
  const missingCerts = requiredCerts.filter(c => !heldCertNames.includes(c))

  return {
    ...employee,
    validCerts,
    invalidCerts,
    continueEdu,
    transferHistory,
    requiredCerts,
    missingCerts
  }
})

// 获取统计数据
ipcMain.handle('get-statistics', async () => {
  // 通过人次：必考证书全部覆盖的在职人员
  const passCount = db.prepare(`
    SELECT COUNT(DISTINCT e.oa_number) as count
    FROM employees e
    WHERE e.status = '在职'
    AND e.ps_position IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM position_cert_map m
      JOIN ps_positions p ON m.position_id = p.id
      WHERE p.position_name = e.ps_position
      AND m.cert_name NOT IN (
        SELECT cert_name FROM certificates
        WHERE oa_number = e.oa_number AND status = '有效'
      )
    )
  `).get().count

  // 应考未考人次：存在至少1项必考证书未获取的在职人员
  const unpassCount = db.prepare(`
    SELECT COUNT(DISTINCT e.oa_number) as count
    FROM employees e
    WHERE e.status = '在职'
    AND e.ps_position IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM position_cert_map m
      JOIN ps_positions p ON m.position_id = p.id
      WHERE p.position_name = e.ps_position
      AND m.cert_name NOT IN (
        SELECT cert_name FROM certificates
        WHERE oa_number = e.oa_number AND status = '有效'
      )
    )
  `).get().count

  return { passCount, unpassCount }
})

// 获取应考未考人员列表（含具体未考证书）
ipcMain.handle('get-unpass-employees', async () => {
  // 先获取所有应考未考人员
  const stmt = db.prepare(`
    SELECT e.*,
      GROUP_CONCAT(DISTINCT CASE WHEN c.status = '有效' THEN c.cert_name END) as held_certs
    FROM employees e
    LEFT JOIN certificates c ON e.oa_number = c.oa_number AND c.status = '有效'
    WHERE e.status = '在职'
    AND e.ps_position IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM position_cert_map m
      JOIN ps_positions p ON m.position_id = p.id
      WHERE p.position_name = e.ps_position
      AND m.cert_name NOT IN (
        SELECT cert_name FROM certificates
        WHERE oa_number = e.oa_number AND status = '有效'
      )
    )
    GROUP BY e.oa_number
    ORDER BY e.oa_number
  `)
  const employees = stmt.all()

  // 为每个员工计算应考未考证书
  return employees.map(emp => {
    const heldCerts = emp.held_certs ? emp.held_certs.split(',') : []

    // 获取该岗位的必考证书
    const requiredCerts = db.prepare(`
      SELECT m.cert_name
      FROM position_cert_map m
      JOIN ps_positions p ON m.position_id = p.id
      WHERE p.position_name = ?
    `).all(emp.ps_position).map(c => c.cert_name)

    // 计算应考未考证书
    const missingCerts = requiredCerts.filter(c => !heldCerts.includes(c))

    return {
      ...emp,
      missing_certs: missingCerts.join('，')
    }
  })
})

// 获取通过人员列表
ipcMain.handle('get-pass-employees', async () => {
  const stmt = db.prepare(`
    SELECT e.*,
      GROUP_CONCAT(DISTINCT CASE WHEN c.status = '有效' THEN c.cert_name END) as held_certs
    FROM employees e
    LEFT JOIN certificates c ON e.oa_number = c.oa_number AND c.status = '有效'
    WHERE e.status = '在职'
    AND e.ps_position IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM position_cert_map m
      JOIN ps_positions p ON m.position_id = p.id
      WHERE p.position_name = e.ps_position
      AND m.cert_name NOT IN (
        SELECT cert_name FROM certificates
        WHERE oa_number = e.oa_number AND status = '有效'
      )
    )
    GROUP BY e.oa_number
    ORDER BY e.oa_number
  `)
  return stmt.all()
})

// 获取PS岗位列表
ipcMain.handle('get-positions', async () => {
  const stmt = db.prepare(`
    SELECT p.*,
      GROUP_CONCAT(m.cert_name) as required_certs
    FROM ps_positions p
    LEFT JOIN position_cert_map m ON p.id = m.position_id
    GROUP BY p.id
    ORDER BY p.position_name
  `)
  return stmt.all()
})

// 导入PS岗位数据
ipcMain.handle('import-positions', async (event, positions) => {
  const insertPosition = db.prepare('INSERT OR IGNORE INTO ps_positions (position_name) VALUES (?)')
  const insertMap = db.prepare('INSERT OR IGNORE INTO position_cert_map (position_id, cert_name) VALUES (?, ?)')
  const getPositionId = db.prepare('SELECT id FROM ps_positions WHERE position_name = ?')

  const transaction = db.transaction(() => {
    for (const pos of positions) {
      insertPosition.run(pos.name)
      const position = getPositionId.get(pos.name)
      if (position && pos.certs) {
        for (const cert of pos.certs) {
          insertMap.run(position.id, cert)
        }
      }
    }
  })

  transaction()
  return { success: true, count: positions.length }
})

// 人员调整导入
ipcMain.handle('import-employee-transfer', async (event, transfers) => {
  const errors = []
  const insertEmployee = db.prepare(`
    INSERT INTO employees (oa_number, name, ps_position, status, remark)
    VALUES (?, ?, ?, '在职', ?)
    ON CONFLICT(oa_number) DO UPDATE SET
      name = excluded.name,
      ps_position = excluded.ps_position,
      remark = excluded.remark,
      update_time = CURRENT_TIMESTAMP
  `)
  const updateEmployeeStatus = db.prepare(`
    UPDATE employees SET status = '离职', remark = '离职', update_time = CURRENT_TIMESTAMP
    WHERE oa_number = ?
  `)
  const insertHistory = db.prepare(`
    INSERT INTO transfer_history (oa_number, transfer_type, old_position, new_position, remark)
    VALUES (?, ?, ?, ?, ?)
  `)
  const getEmployee = db.prepare('SELECT * FROM employees WHERE oa_number = ?')

  const transaction = db.transaction(() => {
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i]
      const idx = i + 2 // Excel 行号从2开始

      // 校验必填字段
      if (!t.oaNumber || !t.name || !t.type) {
        errors.push(`第${idx}行: OA号、姓名、变动类型为必填项`)
        continue
      }

      // 校验变动类型
      if (!['入职', '平调', '离职'].includes(t.type)) {
        errors.push(`第${idx}行: 变动类型必须为"入职"、"平调"或"离职"`)
        continue
      }

      // 校验入职/平调必须有新PS岗位
      if ((t.type === '入职' || t.type === '平调') && !t.newPosition) {
        errors.push(`第${idx}行: 入职/平调必须填写新PS岗位`)
        continue
      }

      const existing = getEmployee.get(t.oaNumber)

      if (t.type === '入职') {
        if (existing && existing.status === '在职') {
          errors.push(`第${idx}行: OA号 ${t.oaNumber} 已存在且在职`)
          continue
        }
        insertEmployee.run(t.oaNumber, t.name, t.newPosition, t.remark || '')
        insertHistory.run(t.oaNumber, '入职', null, t.newPosition, t.remark || '')

      } else if (t.type === '平调') {
        if (!existing) {
          errors.push(`第${idx}行: OA号 ${t.oaNumber} 不存在，无法平调`)
          continue
        }
        if (existing.status !== '在职') {
          errors.push(`第${idx}行: OA号 ${t.oaNumber} 已离职，无法平调`)
          continue
        }
        const oldPosition = existing.ps_position
        insertEmployee.run(t.oaNumber, t.name, t.newPosition, t.remark || existing.remark)
        insertHistory.run(t.oaNumber, '平调', oldPosition, t.newPosition, t.remark || '')

      } else if (t.type === '离职') {
        if (!existing) {
          errors.push(`第${idx}行: OA号 ${t.oaNumber} 不存在，无法离职`)
          continue
        }
        updateEmployeeStatus.run(t.oaNumber)
        insertHistory.run(t.oaNumber, '离职', existing.ps_position, null, t.remark || '')
      }
    }
  })

  try {
    transaction()
    if (errors.length > 0) {
      return { success: false, errors }
    }
    return { success: true, count: transfers.length }
  } catch (err) {
    return { success: false, errors: [err.message] }
  }
})

// 证书新增导入
ipcMain.handle('import-certificates', async (event, certs) => {
  const errors = []
  const insertEmployee = db.prepare(`
    INSERT INTO employees (oa_number, name, ps_position, status)
    VALUES (?, ?, ?, '在职')
    ON CONFLICT(oa_number) DO UPDATE SET
      name = excluded.name,
      ps_position = COALESCE(excluded.ps_position, ps_position)
  `)
  const insertCert = db.prepare(`
    INSERT INTO certificates (oa_number, cert_name, obtain_date, status, remark)
    VALUES (?, ?, ?, '有效', ?)
    ON CONFLICT(oa_number, cert_name) DO UPDATE SET
      obtain_date = excluded.obtain_date,
      status = '有效',
      invalid_date = NULL,
      remark = excluded.remark
  `)

  const transaction = db.transaction(() => {
    for (let i = 0; i < certs.length; i++) {
      const c = certs[i]
      const idx = i + 2

      if (!c.oaNumber || !c.name || !c.certName || !c.obtainDate) {
        errors.push(`第${idx}行: OA号、姓名、证书名称、获取时间为必填项`)
        continue
      }

      insertEmployee.run(c.oaNumber, c.name, c.psPosition || null)
      insertCert.run(c.oaNumber, c.certName, c.obtainDate, c.remark || '')
    }
  })

  try {
    transaction()
    if (errors.length > 0) {
      return { success: false, errors }
    }
    return { success: true, count: certs.length }
  } catch (err) {
    return { success: false, errors: [err.message] }
  }
})

// 继续教育导入
ipcMain.handle('import-continue-edu', async (event, records) => {
  const errors = []
  const insertEdu = db.prepare(`
    INSERT INTO continue_edu (oa_number, cert_name, edu_year, result, remark)
    VALUES (?, ?, ?, ?, ?)
  `)
  const invalidateCert = db.prepare(`
    UPDATE certificates SET status = '失效', invalid_date = DATE('now')
    WHERE oa_number = ? AND cert_name = ? AND status = '有效'
  `)
  const getEmployee = db.prepare('SELECT * FROM employees WHERE oa_number = ?')
  const getCert = db.prepare(`
    SELECT * FROM certificates WHERE oa_number = ? AND cert_name = ?
  `)

  const transaction = db.transaction(() => {
    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      const idx = i + 2

      if (!r.oaNumber || !r.name || !r.certName || !r.eduYear || !r.result) {
        errors.push(`第${idx}行: OA号、姓名、证书名称、继续教育年份、结果为必填项`)
        continue
      }

      if (!['通过', '不通过'].includes(r.result)) {
        errors.push(`第${idx}行: 结果必须为"通过"或"不通过"`)
        continue
      }

      const employee = getEmployee.get(r.oaNumber)
      if (!employee) {
        errors.push(`第${idx}行: OA号 ${r.oaNumber} 不存在`)
        continue
      }

      // 记录继续教育历史
      insertEdu.run(r.oaNumber, r.certName, r.eduYear, r.result, r.remark || '')

      // 如果不通过，将证书标记为失效
      if (r.result === '不通过') {
        const cert = getCert.get(r.oaNumber, r.certName)
        if (cert && cert.status === '有效') {
          invalidateCert.run(r.oaNumber, r.certName)
        }
      }
    }
  })

  try {
    transaction()
    if (errors.length > 0) {
      return { success: false, errors }
    }
    return { success: true, count: records.length }
  } catch (err) {
    return { success: false, errors: [err.message] }
  }
})

// 搜索员工
ipcMain.handle('search-employees', async (event, keyword) => {
  const stmt = db.prepare(`
    SELECT e.*,
      GROUP_CONCAT(DISTINCT CASE WHEN c.status = '有效' THEN c.cert_name END) as held_certs
    FROM employees e
    LEFT JOIN certificates c ON e.oa_number = c.oa_number
    WHERE e.status = '在职'
    AND (e.oa_number LIKE ? OR e.name LIKE ? OR e.ps_position LIKE ?)
    GROUP BY e.oa_number
    ORDER BY e.oa_number
  `)
  const pattern = `%${keyword}%`
  const employees = stmt.all(pattern, pattern, pattern)

  // 为每个员工计算必考证书和应考未考证书（与 getEmployeesFull 一致）
  return employees.map(emp => {
    const heldCerts = emp.held_certs ? emp.held_certs.split(',') : []
    let requiredCerts = []
    let missingCerts = []

    if (emp.ps_position) {
      requiredCerts = db.prepare(`
        SELECT m.cert_name
        FROM position_cert_map m
        JOIN ps_positions p ON m.position_id = p.id
        WHERE p.position_name = ?
      `).all(emp.ps_position).map(c => c.cert_name)

      missingCerts = requiredCerts.filter(c => !heldCerts.includes(c))
    }

    return {
      ...emp,
      held_certs: heldCerts.join('，'),
      required_certs: requiredCerts.join('，'),
      missing_certs: missingCerts.join('，'),
      has_missing: missingCerts.length > 0 ? '是' : '否'
    }
  })
})

// 添加/更新PS岗位
ipcMain.handle('save-position', async (event, { id, name, certs }) => {
  const insertPosition = db.prepare('INSERT OR REPLACE INTO ps_positions (id, position_name, update_time) VALUES (?, ?, CURRENT_TIMESTAMP)')
  const deleteMaps = db.prepare('DELETE FROM position_cert_map WHERE position_id = ?')
  const insertMap = db.prepare('INSERT INTO position_cert_map (position_id, cert_name) VALUES (?, ?)')

  const transaction = db.transaction(() => {
    const result = insertPosition.run(id || null, name)
    const positionId = id || result.lastInsertRowid
    deleteMaps.run(positionId)
    for (const cert of certs) {
      insertMap.run(positionId, cert)
    }
  })

  transaction()
  return { success: true }
})

// 删除PS岗位
ipcMain.handle('delete-position', async (event, id) => {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM position_cert_map WHERE position_id = ?').run(id)
    db.prepare('DELETE FROM ps_positions WHERE id = ?').run(id)
  })
  transaction()
  return { success: true }
})

// 更新员工备注
ipcMain.handle('update-employee-remark', async (event, { oaNumber, remark }) => {
  db.prepare('UPDATE employees SET remark = ?, update_time = CURRENT_TIMESTAMP WHERE oa_number = ?')
    .run(remark, oaNumber)
  return { success: true }
})

// 获取员工完整信息（含计算字段）
ipcMain.handle('get-employees-full', async () => {
  const employees = db.prepare(`
    SELECT e.*,
      GROUP_CONCAT(DISTINCT CASE WHEN c.status = '有效' THEN c.cert_name END) as held_certs
    FROM employees e
    LEFT JOIN certificates c ON e.oa_number = c.oa_number
    WHERE e.status = '在职'
    GROUP BY e.oa_number
    ORDER BY e.oa_number
  `).all()

  // 为每个员工计算必考证书和应考未考证书
  return employees.map(emp => {
    // 注意：SQLite GROUP_CONCAT 默认用逗号分隔
    const heldCerts = emp.held_certs ? emp.held_certs.split(',') : []
    let requiredCerts = []
    let missingCerts = []

    if (emp.ps_position) {
      requiredCerts = db.prepare(`
        SELECT m.cert_name
        FROM position_cert_map m
        JOIN ps_positions p ON m.position_id = p.id
        WHERE p.position_name = ?
      `).all(emp.ps_position).map(c => c.cert_name)

      missingCerts = requiredCerts.filter(c => !heldCerts.includes(c))
    }

    return {
      ...emp,
      held_certs: heldCerts.join('，'),
      required_certs: requiredCerts.join('，'),
      missing_certs: missingCerts.join('，'),
      has_missing: missingCerts.length > 0 ? '是' : '否'
    }
  })
})

// 导出数据为Excel
ipcMain.handle('export-excel', async (event, { type, data }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${type}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    filters: [{ name: 'Excel文件', extensions: ['xlsx'] }]
  })

  if (!filePath) return { success: false, message: '取消导出' }

  return { success: true, filePath }
})

// 选择Excel文件
ipcMain.handle('select-excel-file', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Excel文件', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile']
  })
  return filePaths[0] || null
})

// 读取Excel文件
ipcMain.handle('read-excel', async (event, filePath) => {
  const XLSX = require('xlsx')
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet)
})

// 数据库备份
ipcMain.handle('backup-database', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `certificate_backup_${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: '数据库文件', extensions: ['db'] }]
  })

  if (!filePath) return { success: false }

  try {
    fs.copyFileSync(dbPath, filePath)
    return { success: true, filePath }
  } catch (err) {
    return { success: false, message: err.message }
  }
})

// 数据库恢复
ipcMain.handle('restore-database', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: '数据库文件', extensions: ['db'] }],
    properties: ['openFile']
  })

  if (!filePaths[0]) return { success: false }

  try {
    db.close()
    fs.copyFileSync(filePaths[0], dbPath)
    initDatabase()
    return { success: true }
  } catch (err) {
    return { success: false, message: err.message }
  }
})

// 获取所有证书名称（用于下拉选择）
ipcMain.handle('get-all-cert-names', async () => {
  const certs = db.prepare(`
    SELECT DISTINCT cert_name FROM position_cert_map
    UNION
    SELECT DISTINCT cert_name FROM certificates
  `).all()
  return certs.map(c => c.cert_name)
})
