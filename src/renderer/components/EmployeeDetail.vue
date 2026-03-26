<template>
  <el-dialog
    v-model="visible"
    :title="employee ? `${employee.name} - 证书详情` : '员工详情'"
    width="900"
    top="5vh"
    destroy-on-close
    class="employee-detail-dialog"
  >
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" :size="40"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <div v-else-if="employee" class="detail-container">
      <!-- 基础信息卡片 -->
      <el-card class="info-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon><User /></el-icon>
            <span>基础信息</span>
          </div>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="OA号">{{ employee.oa_number }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ employee.name }}</el-descriptions-item>
          <el-descriptions-item label="PS岗位">{{ employee.ps_position || '待补充' }}</el-descriptions-item>
          <el-descriptions-item label="人员状态">
            <el-tag :type="employee.status === '在职' ? 'success' : 'danger'">{{ employee.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ employee.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 证书统计卡片 -->
      <el-card class="info-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon><Document /></el-icon>
            <span>证书概况</span>
          </div>
        </template>
        <el-row :gutter="16">
          <el-col :span="6">
            <div class="cert-stat">
              <div class="cert-stat-value success">{{ employee.validCerts?.length || 0 }}</div>
              <div class="cert-stat-label">已持有效证书</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="cert-stat">
              <div class="cert-stat-value warning">{{ employee.requiredCerts?.length || 0 }}</div>
              <div class="cert-stat-label">必考证书</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="cert-stat">
              <div class="cert-stat-value danger">{{ employee.missingCerts?.length || 0 }}</div>
              <div class="cert-stat-label">应考未考证书</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="cert-stat">
              <div class="cert-stat-value info">{{ employee.invalidCerts?.length || 0 }}</div>
              <div class="cert-stat-label">失效证书</div>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <!-- 证书明细 -->
      <el-card class="info-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon><Tickets /></el-icon>
            <span>证书明细</span>
          </div>
        </template>
        <el-tabs v-model="activeCertTab">
          <el-tab-pane label="已持有效证书" name="valid">
            <el-table :data="employee.validCerts" stripe border max-height="200">
              <el-table-column prop="cert_name" label="证书名称" />
              <el-table-column prop="obtain_date" label="获取时间" width="120" />
            </el-table>
            <el-empty v-if="!employee.validCerts?.length" description="暂无有效证书" />
          </el-tab-pane>
          <el-tab-pane label="应考未考证书" name="missing">
            <el-table :data="missingCertsList" stripe border max-height="200">
              <el-table-column prop="name" label="证书名称" />
              <el-table-column label="状态" width="100">
                <template #default>
                  <el-tag type="danger">未获取</el-tag>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="!employee.missingCerts?.length" description="已全部获取" />
          </el-tab-pane>
          <el-tab-pane label="失效证书历史" name="invalid">
            <el-table :data="employee.invalidCerts" stripe border max-height="200">
              <el-table-column prop="cert_name" label="证书名称" />
              <el-table-column prop="obtain_date" label="获取时间" width="120" />
              <el-table-column prop="invalid_date" label="失效时间" width="120" />
            </el-table>
            <el-empty v-if="!employee.invalidCerts?.length" description="暂无失效证书" />
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <!-- 继续教育历史 -->
      <el-card class="info-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon><Clock /></el-icon>
            <span>继续教育历史</span>
          </div>
        </template>
        <el-table :data="employee.continueEdu" stripe border max-height="200">
          <el-table-column prop="cert_name" label="证书名称" />
          <el-table-column prop="edu_year" label="继续教育年份" width="120" />
          <el-table-column prop="result" label="结果" width="100">
            <template #default="{ row }">
              <el-tag :type="row.result === '通过' ? 'success' : 'danger'">{{ row.result }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="create_time" label="操作时间" width="180">
            <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!employee.continueEdu?.length" description="暂无继续教育记录" />
      </el-card>

      <!-- 人员变动历史 -->
      <el-card class="info-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon><Switch /></el-icon>
            <span>人员变动历史</span>
          </div>
        </template>
        <el-timeline>
          <el-timeline-item
            v-for="(item, index) in employee.transferHistory"
            :key="index"
            :type="getTimelineType(item.transfer_type)"
            :timestamp="formatDateTime(item.create_time)"
            placement="top"
          >
            <el-card>
              <div class="timeline-content">
                <el-tag :type="getTagType(item.transfer_type)" effect="dark">{{ item.transfer_type }}</el-tag>
                <span v-if="item.transfer_type === '入职'">入职于 {{ item.new_position || '未知岗位' }}</span>
                <span v-else-if="item.transfer_type === '平调'">从 {{ item.old_position || '未知' }} 调至 {{ item.new_position || '未知' }}</span>
                <span v-else>从 {{ item.old_position || '未知' }} 离职</span>
                <span v-if="item.remark" class="timeline-remark">备注: {{ item.remark }}</span>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-if="!employee.transferHistory?.length" description="暂无变动记录" />
      </el-card>
    </div>

    <el-empty v-else description="未找到员工信息" />

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { User, Document, Tickets, Clock, Switch, Loading } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: Boolean,
  oaNumber: String
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const loading = ref(false)
const employee = ref(null)
const activeCertTab = ref('valid')

// 应考未考证书列表
const missingCertsList = computed(() => {
  return (employee.value?.missingCerts || []).map(name => ({ name }))
})

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

// 时间线类型
const getTimelineType = (type) => {
  const types = { '入职': 'primary', '平调': 'warning', '离职': 'danger' }
  return types[type] || 'info'
}

// 标签类型
const getTagType = (type) => {
  const types = { '入职': 'success', '平调': 'warning', '离职': 'danger' }
  return types[type] || 'info'
}

// 监听弹窗打开
watch(visible, async (val) => {
  if (val && props.oaNumber) {
    loading.value = true
    try {
      employee.value = await window.electronAPI.getEmployeeDetail(props.oaNumber)
    } catch (err) {
      console.error('获取员工详情失败:', err)
    } finally {
      loading.value = false
    }
  }
})
</script>

<style scoped>
.employee-detail-dialog :deep(.el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: #909399;
}

.detail-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
}

.cert-stat {
  text-align: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.cert-stat-value {
  font-size: 28px;
  font-weight: 700;
}

.cert-stat-value.success { color: #67c23a; }
.cert-stat-value.warning { color: #e6a23c; }
.cert-stat-value.danger { color: #f56c6c; }
.cert-stat-value.info { color: #909399; }

.cert-stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.timeline-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timeline-remark {
  margin-left: auto;
  color: #909399;
  font-size: 12px;
}
</style>
