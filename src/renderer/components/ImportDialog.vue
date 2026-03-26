<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="600"
    destroy-on-close
    class="import-dialog"
  >
    <div class="import-container">
      <!-- 说明 -->
      <el-alert
        v-if="importType === 'transfer'"
        title="说明：变动类型为入职/平调/离职，入职和平调需填写新PS岗位"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-alert
        v-else-if="importType === 'certificate'"
        title="说明：PS岗位可选填写，如填写会自动更新人员岗位信息"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-alert
        v-else-if="importType === 'continueEdu'"
        title="说明：继续教育结果为通过/不通过，不通过会将证书标记为失效"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />

      <!-- 文件上传 -->
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls"
        :on-change="handleFileChange"
        drag
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          将文件拖到此处，或<em>点击选择文件</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">只能上传 xlsx/xls 文件</div>
        </template>
      </el-upload>

      <!-- 预览数据 -->
      <div v-if="previewData.length > 0" class="preview-section">
        <h4>数据预览 (前10条)</h4>
        <el-table :data="previewData.slice(0, 10)" stripe border max-height="300">
          <el-table-column
            v-for="col in previewColumns"
            :key="col"
            :prop="col"
            :label="col"
            show-overflow-tooltip
          />
        </el-table>
        <p class="total-info">共 {{ previewData.length }} 条数据</p>
      </div>

      <!-- 错误信息 -->
      <div v-if="errors.length > 0" class="error-section">
        <h4>错误信息</h4>
        <el-alert
          v-for="(err, idx) in errors"
          :key="idx"
          :title="err"
          type="error"
          :closable="false"
          style="margin-bottom: 8px"
        />
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleImport" :loading="importing" :disabled="!previewData.length">
        确认导入
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

const props = defineProps({
  modelValue: Boolean,
  type: String
})

const emit = defineEmits(['update:modelValue', 'success'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const uploadRef = ref(null)
const previewData = ref([])
const previewColumns = ref([])
const errors = ref([])
const importing = ref(false)

// 弹窗标题
const dialogTitle = computed(() => {
  const titles = {
    position: '导入PS岗位数据',
    transfer: '导入人员调整',
    certificate: '导入证书新增',
    continueEdu: '导入继续教育'
  }
  return titles[props.type] || '导入数据'
})

// 文件选择处理 - 使用 FileReader 在渲染进程读取
const handleFileChange = (uploadFile) => {
  if (!uploadFile || !uploadFile.raw) return

  errors.value = []
  const file = uploadFile.raw

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet)

      previewData.value = jsonData
      previewColumns.value = jsonData.length > 0 ? Object.keys(jsonData[0]) : []
    } catch (err) {
      ElMessage.error('读取文件失败: ' + err.message)
      previewData.value = []
      previewColumns.value = []
    }
  }
  reader.readAsArrayBuffer(file)
}

// 执行导入
const handleImport = async () => {
  if (!previewData.value.length) return

  importing.value = true
  errors.value = []

  try {
    let result

    switch (props.type) {
      case 'position':
        const positions = previewData.value.map(row => ({
          name: row['必考岗位'] || row['PS岗位'],
          certs: (row['必考证书'] || row['证书'] || '').split(/[,，]/).map(c => c.trim()).filter(Boolean)
        })).filter(p => p.name)
        result = await window.electronAPI.importPositions(positions)
        break

      case 'transfer':
        const transfers = previewData.value.map(row => ({
          oaNumber: String(row['OA号'] || '').trim(),
          name: String(row['姓名'] || '').trim(),
          type: String(row['变动类型'] || '').trim(),
          newPosition: String(row['新PS岗位'] || '').trim(),
          remark: String(row['备注'] || '').trim()
        })).filter(t => t.oaNumber)
        result = await window.electronAPI.importEmployeeTransfer(transfers)
        break

      case 'certificate':
        const certs = previewData.value.map(row => ({
          oaNumber: String(row['OA号'] || '').trim(),
          name: String(row['姓名'] || '').trim(),
          psPosition: String(row['PS岗位'] || '').trim(),
          certName: String(row['证书名称'] || '').trim(),
          obtainDate: String(row['获取时间'] || '').trim(),
          remark: String(row['备注'] || '').trim()
        })).filter(c => c.oaNumber && c.certName)
        result = await window.electronAPI.importCertificates(certs)
        break

      case 'continueEdu':
        const eduRecords = previewData.value.map(row => ({
          oaNumber: String(row['OA号'] || '').trim(),
          name: String(row['姓名'] || '').trim(),
          certName: String(row['证书名称'] || '').trim(),
          eduYear: String(row['继续教育年份'] || '').trim(),
          result: String(row['结果'] || '').trim(),
          remark: String(row['备注'] || '').trim()
        })).filter(e => e.oaNumber && e.certName)
        result = await window.electronAPI.importContinueEdu(eduRecords)
        break
    }

    if (result.success) {
      ElMessage.success(`成功导入 ${result.count} 条数据`)
      visible.value = false
      emit('success')
    } else {
      errors.value = result.errors || ['导入失败']
    }
  } catch (err) {
    errors.value = [err.message]
  } finally {
    importing.value = false
  }
}

// 重置状态
watch(visible, (val) => {
  if (!val) {
    previewData.value = []
    previewColumns.value = []
    errors.value = []
  }
})
</script>

<style scoped>
.import-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-section {
  margin-top: 16px;
}

.preview-section h4 {
  margin-bottom: 8px;
  color: #606266;
}

.total-info {
  margin-top: 8px;
  color: #909399;
  font-size: 13px;
}

.error-section {
  margin-top: 16px;
}

.error-section h4 {
  margin-bottom: 8px;
  color: #f56c6c;
}
</style>
