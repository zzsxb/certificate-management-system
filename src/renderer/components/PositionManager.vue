<template>
  <el-dialog
    v-model="visible"
    title="PS岗位管理"
    width="1000"
    top="5vh"
    destroy-on-close
    class="position-manager-dialog"
  >
    <div class="manager-container">
      <!-- 工具栏 -->
      <div class="toolbar">
        <el-button type="primary" @click="showAddDialog" :icon="Plus">新增岗位</el-button>
        <el-button @click="handleBatchImport" :icon="Upload">批量导入</el-button>
        <el-button @click="exportPositions" :icon="Download">导出列表</el-button>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索岗位/证书..."
          style="width: 240px; margin-left: auto"
          clearable
          @input="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <!-- 岗位列表 -->
      <el-table
        :data="filteredPositions"
        stripe
        border
        height="500"
        v-loading="loading"
      >
        <el-table-column prop="position_name" label="PS岗位" width="250" />
        <el-table-column prop="required_certs" label="必考证书" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag
              v-for="cert in (row.required_certs || '').split(',')"
              :key="cert"
              size="small"
              style="margin-right: 4px; margin-bottom: 4px"
            >
              {{ cert }}
            </el-tag>
            <span v-if="!row.required_certs" class="no-data">暂无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="editPosition(row)">编辑</el-button>
            <el-popconfirm title="确定删除该岗位吗？" @confirm="deletePosition(row.id)">
              <template #reference>
                <el-button type="danger" link>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="editForm.id ? '编辑岗位' : '新增岗位'"
      width="500"
      append-to-body
    >
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="PS岗位" required>
          <el-input v-model="editForm.name" placeholder="请输入PS岗位名称" />
        </el-form-item>
        <el-form-item label="必考证书">
          <el-select
            v-model="editForm.certs"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入证书名称"
            style="width: 100%"
          >
            <el-option
              v-for="cert in allCertNames"
              :key="cert"
              :label="cert"
              :value="cert"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePosition">保存</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Plus, Upload, Download, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'refresh'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const loading = ref(false)
const positions = ref([])
const searchKeyword = ref('')
const editDialogVisible = ref(false)
const editForm = ref({ id: null, name: '', certs: [] })
const allCertNames = ref([])

// 过滤后的岗位列表
const filteredPositions = computed(() => {
  if (!searchKeyword.value) return positions.value
  const keyword = searchKeyword.value.toLowerCase()
  return positions.value.filter(p =>
    p.position_name.toLowerCase().includes(keyword) ||
    (p.required_certs && p.required_certs.toLowerCase().includes(keyword))
  )
})

// 加载岗位数据
const loadPositions = async () => {
  loading.value = true
  try {
    positions.value = await window.electronAPI.getPositions()
    allCertNames.value = await window.electronAPI.getAllCertNames()
  } catch (err) {
    ElMessage.error('加载数据失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  // 过滤由 computed 处理
}

// 显示新增弹窗
const showAddDialog = () => {
  editForm.value = { id: null, name: '', certs: [] }
  editDialogVisible.value = true
}

// 编辑岗位
const editPosition = (row) => {
  editForm.value = {
    id: row.id,
    name: row.position_name,
    certs: row.required_certs ? row.required_certs.split(',') : []
  }
  editDialogVisible.value = true
}

// 保存岗位
const savePosition = async () => {
  if (!editForm.value.name.trim()) {
    ElMessage.warning('请输入PS岗位名称')
    return
  }
  try {
    await window.electronAPI.savePosition(editForm.value)
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    loadPositions()
    emit('refresh')
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  }
}

// 删除岗位
const deletePosition = async (id) => {
  try {
    await window.electronAPI.deletePosition(id)
    ElMessage.success('删除成功')
    loadPositions()
    emit('refresh')
  } catch (err) {
    ElMessage.error('删除失败: ' + err.message)
  }
}

// 批量导入
const handleBatchImport = async () => {
  try {
    const filePath = await window.electronAPI.selectExcelFile()
    if (!filePath) return

    const data = await window.electronAPI.readExcel(filePath)
    const positions = []

    for (const row of data) {
      const name = row['必考岗位'] || row['PS岗位']
      const certs = row['必考证书'] || row['证书']

      if (name) {
        positions.push({
          name: name.trim(),
          certs: certs ? certs.split(/[,，]/).map(c => c.trim()).filter(Boolean) : []
        })
      }
    }

    if (positions.length === 0) {
      ElMessage.warning('未解析到有效数据，请检查文件格式')
      return
    }

    await window.electronAPI.importPositions(positions)
    ElMessage.success(`成功导入 ${positions.length} 条岗位数据`)
    loadPositions()
    emit('refresh')
  } catch (err) {
    ElMessage.error('导入失败: ' + err.message)
  }
}

// 导出岗位列表
const exportPositions = () => {
  if (positions.value.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const exportData = positions.value.map(p => ({
    '必考岗位': p.position_name,
    '必考证书': p.required_certs || ''
  }))

  const ws = XLSX.utils.json_to_sheet(exportData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'PS岗位对照表')
  XLSX.writeFile(wb, `PS岗位对照表_${new Date().toISOString().slice(0, 10)}.xlsx`)
  ElMessage.success('导出成功')
}

// 监听弹窗打开
watch(visible, (val) => {
  if (val) loadPositions()
})
</script>

<style scoped>
.manager-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.no-data {
  color: #c0c4cc;
}
</style>
