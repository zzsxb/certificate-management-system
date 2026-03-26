<template>
  <el-dialog
    v-model="visible"
    title="通过人员详情"
    width="1200"
    top="5vh"
    destroy-on-close
    class="pass-dialog"
  >
    <div class="dialog-container">
      <div class="toolbar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索OA号/姓名/岗位..."
          style="width: 240px"
          clearable
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button :icon="Download" @click="exportData">导出数据</el-button>
      </div>

      <el-table
        :data="filteredEmployees"
        stripe
        border
        height="500"
        highlight-current-row
        @row-dblclick="showDetail"
      >
        <el-table-column prop="oa_number" label="OA号" width="120" fixed />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="ps_position" label="PS岗位" width="180" show-overflow-tooltip />
        <el-table-column prop="held_certs" label="已持证书" min-width="300" show-overflow-tooltip />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="showDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 员工详情弹窗 -->
    <EmployeeDetail
      v-model="detailVisible"
      :oa-number="currentOA"
    />
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import EmployeeDetail from './EmployeeDetail.vue'

const props = defineProps({
  modelValue: Boolean,
  employees: Array
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const searchKeyword = ref('')
const detailVisible = ref(false)
const currentOA = ref('')

// 过滤后的员工列表
const filteredEmployees = computed(() => {
  if (!searchKeyword.value || !props.employees) return props.employees
  const keyword = searchKeyword.value.toLowerCase()
  return props.employees.filter(e =>
    e.oa_number.toLowerCase().includes(keyword) ||
    e.name.toLowerCase().includes(keyword) ||
    (e.ps_position && e.ps_position.toLowerCase().includes(keyword))
  )
})

// 显示详情
const showDetail = (row) => {
  currentOA.value = row.oa_number
  detailVisible.value = true
}

// 导出数据
const exportData = () => {
  if (!filteredEmployees.value?.length) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const exportData = filteredEmployees.value.map(e => ({
    'OA号': e.oa_number,
    '姓名': e.name,
    'PS岗位': e.ps_position || '',
    '已持证书': e.held_certs || ''
  }))

  const ws = XLSX.utils.json_to_sheet(exportData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '通过人员')
  XLSX.writeFile(wb, `通过人员_${new Date().toISOString().slice(0, 10)}.xlsx`)
  ElMessage.success('导出成功')
}
</script>

<style scoped>
.dialog-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>
