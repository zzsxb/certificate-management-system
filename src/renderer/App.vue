<template>
  <div class="app-container">
    <!-- 顶部标题栏 -->
    <header class="app-header">
      <div class="header-left">
        <h1>郑州分行持证上岗证书管理系统</h1>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="showBackupDialog" :icon="Download">数据备份</el-button>
        <el-button @click="showRestoreDialog" :icon="Upload">数据恢复</el-button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="app-main">
      <!-- 操作栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchKeyword"
            placeholder="输入OA号/姓名/PS岗位搜索..."
            style="width: 280px"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="handleSearch" :icon="Search">搜索</el-button>
          <el-button @click="resetSearch" :icon="Refresh">重置</el-button>
        </div>
        <div class="toolbar-right">
          <el-dropdown @command="handleImportCommand" style="margin-right: 12px">
            <el-button type="primary" :icon="Upload">
              数据导入 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="position">PS岗位数据</el-dropdown-item>
                <el-dropdown-item command="transfer">人员调整</el-dropdown-item>
                <el-dropdown-item command="certificate">证书新增</el-dropdown-item>
                <el-dropdown-item command="continueEdu">继续教育</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown @command="handleDownloadCommand" style="margin-right: 12px">
            <el-button :icon="Download">
              模板下载 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="position">PS岗位模板</el-dropdown-item>
                <el-dropdown-item command="transfer">人员调整模板</el-dropdown-item>
                <el-dropdown-item command="certificate">证书新增模板</el-dropdown-item>
                <el-dropdown-item command="continueEdu">继续教育模板</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button type="info" @click="showPositionManager" :icon="Setting">岗位管理</el-button>
          <el-button type="warning" @click="showUnpassDialog" :icon="Warning">应考未考详情</el-button>
          <el-button :icon="Download" @click="exportCurrentData">导出当前数据</el-button>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="stats-cards">
        <div class="stat-card pass" @dblclick="showPassDialog">
          <div class="stat-icon">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ statistics.passCount }}</div>
            <div class="stat-label">通过人次</div>
          </div>
          <div class="stat-hint">双击查看详情</div>
        </div>
        <div class="stat-card unpass" @dblclick="showUnpassDialog">
          <div class="stat-icon">
            <el-icon><Warning /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ statistics.unpassCount }}</div>
            <div class="stat-label">应考未考人次</div>
          </div>
          <div class="stat-hint">双击查看详情</div>
        </div>
        <div class="stat-card total">
          <div class="stat-icon">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ employees.length }}</div>
            <div class="stat-label">在职人员</div>
          </div>
        </div>
        <div class="stat-card positions">
          <div class="stat-icon">
            <el-icon><Briefcase /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ positionCount }}</div>
            <div class="stat-label">PS岗位数</div>
          </div>
        </div>
      </div>

      <!-- 主表格 -->
      <div class="table-container">
        <el-table
          ref="mainTableRef"
          :data="tableData"
          stripe
          border
          highlight-current-row
          :row-class-name="tableRowClassName"
          @row-dblclick="showEmployeeDetail"
          v-loading="loading"
          height="calc(100vh - 340px)"
          style="width: 100%"
        >
          <el-table-column prop="oa_number" label="OA号" width="120" fixed />
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="ps_position" label="PS岗位" width="180" show-overflow-tooltip />
          <el-table-column prop="held_certs" label="已持证书" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="{ 'no-data': !row.held_certs }">{{ row.held_certs || '暂无' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="required_certs" label="必考证书" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="{ 'no-data': !row.required_certs }">{{ row.required_certs || '暂无' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="missing_certs" label="应考未考证书" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="missing-cert" v-if="row.missing_certs">{{ row.missing_certs }}</span>
              <span class="no-data" v-else>无</span>
            </template>
          </el-table-column>
          <el-table-column prop="has_missing" label="是否有应考未考" width="130" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.has_missing === '是'" type="danger" effect="dark">是</el-tag>
              <el-tag v-else type="success" effect="dark">否</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="{ 'resigned': row.status === '离职' }">{{ row.remark || '-' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <!-- 员工详情弹窗 -->
    <EmployeeDetail
      v-model="employeeDetailVisible"
      :oa-number="currentEmployeeOA"
    />

    <!-- 岗位管理弹窗 -->
    <PositionManager
      v-model="positionManagerVisible"
      @refresh="refreshData"
    />

    <!-- 应考未考人员弹窗 -->
    <UnpassDialog
      v-model="unpassDialogVisible"
      :employees="unpassEmployees"
    />

    <!-- 通过人员弹窗 -->
    <PassDialog
      v-model="passDialogVisible"
      :employees="passEmployees"
    />

    <!-- 导入对话框 -->
    <ImportDialog
      v-model="importDialogVisible"
      :type="importType"
      @success="handleImportSuccess"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  Search, Refresh, Download, Upload, Setting, Warning,
  CircleCheck, User, Briefcase, ArrowDown
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import EmployeeDetail from './components/EmployeeDetail.vue'
import PositionManager from './components/PositionManager.vue'
import UnpassDialog from './components/UnpassDialog.vue'
import PassDialog from './components/PassDialog.vue'
import ImportDialog from './components/ImportDialog.vue'

// 数据状态
const loading = ref(false)
const employees = ref([])
const statistics = ref({ passCount: 0, unpassCount: 0 })
const positionCount = ref(0)
const searchKeyword = ref('')

// 弹窗状态
const employeeDetailVisible = ref(false)
const positionManagerVisible = ref(false)
const unpassDialogVisible = ref(false)
const passDialogVisible = ref(false)
const importDialogVisible = ref(false)
const importType = ref('')
const currentEmployeeOA = ref('')
const unpassEmployees = ref([])
const passEmployees = ref([])

const mainTableRef = ref(null)

// 表格数据
const tableData = computed(() => employees.value)

// 表格行样式
const tableRowClassName = ({ row }) => {
  if (row.status === '离职') return 'resigned-row'
  if (row.has_missing === '是') return 'warning-row'
  return ''
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const [empData, stats, positions] = await Promise.all([
      window.electronAPI.getEmployeesFull(),
      window.electronAPI.getStatistics(),
      window.electronAPI.getPositions()
    ])
    // 强制创建新数组触发响应式更新
    employees.value = [...empData]
    statistics.value = { ...stats }
    positionCount.value = positions.length
  } catch (err) {
    ElMessage.error('数据加载失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = async () => {
  if (!searchKeyword.value.trim()) {
    loadData()
    return
  }
  loading.value = true
  try {
    const result = await window.electronAPI.searchEmployees(searchKeyword.value)
    // 直接使用后端返回的数据（已包含计算字段）
    employees.value = [...result]
  } catch (err) {
    ElMessage.error('搜索失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchKeyword.value = ''
  loadData()
}

// 显示员工详情
const showEmployeeDetail = (row) => {
  currentEmployeeOA.value = row.oa_number
  employeeDetailVisible.value = true
}

// 显示岗位管理
const showPositionManager = () => {
  positionManagerVisible.value = true
}

// 显示应考未考弹窗
const showUnpassDialog = async () => {
  try {
    unpassEmployees.value = await window.electronAPI.getUnpassEmployees()
    unpassDialogVisible.value = true
  } catch (err) {
    ElMessage.error('获取数据失败: ' + err.message)
  }
}

// 显示通过人员弹窗
const showPassDialog = async () => {
  try {
    passEmployees.value = await window.electronAPI.getPassEmployees()
    passDialogVisible.value = true
  } catch (err) {
    ElMessage.error('获取数据失败: ' + err.message)
  }
}

// 导入命令处理
const handleImportCommand = (command) => {
  importType.value = command
  importDialogVisible.value = true
}

// 导入成功处理
const handleImportSuccess = () => {
  refreshData()
}

// 刷新数据
const refreshData = () => {
  loadData()
}

// 模板下载
const handleDownloadCommand = (command) => {
  const templates = {
    position: { name: 'PS岗位模板.xlsx', data: [{ '必考岗位': '', '必考证书': '' }] },
    transfer: { name: '人员调整模板.xlsx', data: [{ 'OA号': '', '姓名': '', '变动类型': '', '新PS岗位': '', '备注': '' }] },
    certificate: { name: '证书新增模板.xlsx', data: [{ 'OA号': '', '姓名': '', 'PS岗位': '', '证书名称': '', '获取时间': '', '备注': '' }] },
    continueEdu: { name: '继续教育模板.xlsx', data: [{ 'OA号': '', '姓名': '', '证书名称': '', '继续教育年份': '', '结果': '', '备注': '' }] }
  }

  const template = templates[command]
  const ws = XLSX.utils.json_to_sheet(template.data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, template.name)
  ElMessage.success('模板下载成功')
}

// 导出当前数据
const exportCurrentData = () => {
  if (employees.value.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const exportData = employees.value.map(emp => ({
    'OA号': emp.oa_number,
    '姓名': emp.name,
    'PS岗位': emp.ps_position || '',
    '已持证书': emp.held_certs || '',
    '必考证书': emp.required_certs || '',
    '应考未考证书': emp.missing_certs || '',
    '是否有应考未考': emp.has_missing,
    '备注': emp.remark || ''
  }))

  const ws = XLSX.utils.json_to_sheet(exportData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '人员证书数据')
  XLSX.writeFile(wb, `人员证书数据_${new Date().toISOString().slice(0, 10)}.xlsx`)
  ElMessage.success('导出成功')
}

// 数据备份
const showBackupDialog = async () => {
  try {
    const result = await window.electronAPI.backupDatabase()
    if (result.success) {
      ElMessage.success('备份成功: ' + result.filePath)
    }
  } catch (err) {
    ElMessage.error('备份失败: ' + err.message)
  }
}

// 数据恢复
const showRestoreDialog = async () => {
  try {
    await ElMessageBox.confirm('恢复数据将覆盖当前所有数据，是否继续？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const result = await window.electronAPI.restoreDatabase()
    if (result.success) {
      ElMessage.success('恢复成功')
      loadData()
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('恢复失败: ' + err.message)
    }
  }
}

// 初始化
onMounted(() => {
  loadData()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
}

/* 头部样式 */
.app-header {
  height: 60px;
  background: linear-gradient(90deg, #1a73e8 0%, #4285f4 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 2px 12px rgba(26, 115, 232, 0.3);
}

.app-header h1 {
  color: #fff;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 2px;
}

.header-right {
  display: flex;
  gap: 12px;
}

/* 主内容区 */
.app-main {
  flex: 1;
  padding: 16px 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.toolbar-left, .toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.stat-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.stat-card.pass::before { background: #67c23a; }
.stat-card.unpass::before { background: #f56c6c; }
.stat-card.total::before { background: #409eff; }
.stat-card.positions::before { background: #e6a23c; }

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
}

.stat-card.pass .stat-icon { background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%); }
.stat-card.unpass .stat-icon { background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%); }
.stat-card.total .stat-icon { background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%); }
.stat-card.positions .stat-icon { background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%); }

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.stat-hint {
  position: absolute;
  right: 12px;
  bottom: 8px;
  font-size: 12px;
  color: #c0c4cc;
}

/* 表格容器 */
.table-container {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

/* 表格样式 */
.el-table {
  font-size: 13px;
}

.el-table .warning-row {
  background: #fef0f0;
}

.el-table .resigned-row {
  background: #f5f5f5;
  color: #f56c6c;
}

.no-data {
  color: #c0c4cc;
}

.missing-cert {
  color: #f56c6c;
  font-weight: 500;
}

.resigned {
  color: #f56c6c;
}

/* Element Plus 覆盖 */
.el-button--primary {
  background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);
  border: none;
}

.el-button--primary:hover {
  background: linear-gradient(135deg, #1557b0 0%, #3b78e7 100%);
}

.el-tag--danger {
  background: #fef0f0;
  border-color: #fde2e2;
  color: #f56c6c;
}

.el-tag--success {
  background: #f0f9eb;
  border-color: #e1f3d8;
  color: #67c23a;
}
</style>
