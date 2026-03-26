# 数据库表结构设计文档

## 一、表结构总览

系统共设计 **7 张核心数据表**，覆盖人员、证书、岗位、继续教育全流程管理。

```
┌─────────────────┐     ┌─────────────────┐
│   employees     │────<│   certificates  │
│   (人员信息)     │     │   (证书明细)     │
└────────┬────────┘     └─────────────────┘
         │
         │              ┌─────────────────┐
         └─────────────>│ continue_edu    │
                        │ (继续教育记录)   │
                        └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│   ps_positions  │────<│position_cert_map│
│   (PS岗位)       │     │(岗位证书映射)    │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│ transfer_history│     │   cert_names    │
│ (人员变动历史)   │     │ (证书名称字典)   │
└─────────────────┘     └─────────────────┘
```

---

## 二、详细表结构

### 2.1 employees（人员信息表）

**说明**：存储员工基础信息，OA号为主键唯一标识。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| oa_number | VARCHAR(50) | PRIMARY KEY | OA号，唯一标识 |
| name | VARCHAR(100) | NOT NULL | 姓名 |
| ps_position | VARCHAR(100) | | PS岗位（可为空，支持后续补充） |
| status | VARCHAR(20) | DEFAULT '在职' | 状态：在职/离职 |
| remark | TEXT | | 备注 |
| create_time | DATETIME | DEFAULT CURRENT_TIMESTAMP | 入职时间/创建时间 |
| update_time | DATETIME | | 最后更新时间 |

**索引**：
- `idx_name` ON (name) - 支持姓名模糊查询
- `idx_status` ON (status) - 支持在职/离职筛选

---

### 2.2 certificates（证书明细表）

**说明**：存储员工持有的证书，OA号+证书名称唯一约束。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| oa_number | VARCHAR(50) | NOT NULL | OA号，外键关联employees |
| cert_name | VARCHAR(200) | NOT NULL | 证书名称 |
| obtain_date | DATE | NOT NULL | 获取时间 |
| status | VARCHAR(20) | DEFAULT '有效' | 状态：有效/失效 |
| invalid_date | DATE | | 失效时间（继续教育不通过时记录） |
| remark | TEXT | | 备注 |
| create_time | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**约束**：
- `UNIQUE(oa_number, cert_name)` - 同一人同一证书仅保留一条有效记录

**索引**：
- `idx_oa_number` ON (oa_number)
- `idx_status` ON (status)

---

### 2.3 continue_edu（继续教育记录表）

**说明**：永久存储继续教育历史，支持按年份追溯。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| oa_number | VARCHAR(50) | NOT NULL | OA号 |
| cert_name | VARCHAR(200) | NOT NULL | 证书名称 |
| edu_year | INTEGER | NOT NULL | 继续教育年份 |
| result | VARCHAR(20) | NOT NULL | 结果：通过/不通过 |
| remark | TEXT | | 备注 |
| create_time | DATETIME | DEFAULT CURRENT_TIMESTAMP | 操作时间 |

**索引**：
- `idx_oa_cert` ON (oa_number, cert_name)
- `idx_edu_year` ON (edu_year)

---

### 2.4 ps_positions（PS岗位表）

**说明**：存储所有PS岗位，作为岗位-证书映射的主表。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| position_name | VARCHAR(100) | UNIQUE NOT NULL | PS岗位名称 |
| remark | TEXT | | 备注 |
| create_time | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| update_time | DATETIME | | 更新时间 |

---

### 2.5 position_cert_map（岗位-证书映射表）

**说明**：定义每个PS岗位对应的必考证书，多对多关系。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| position_id | INTEGER | NOT NULL | PS岗位ID，外键 |
| cert_name | VARCHAR(200) | NOT NULL | 必考证书名称 |
| create_time | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**约束**：
- `UNIQUE(position_id, cert_name)` - 同一岗位同一证书不重复
- `FOREIGN KEY (position_id) REFERENCES ps_positions(id)`

---

### 2.6 transfer_history（人员变动历史表）

**说明**：记录人员入职/平调/离职的完整历史轨迹。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| oa_number | VARCHAR(50) | NOT NULL | OA号 |
| transfer_type | VARCHAR(20) | NOT NULL | 变动类型：入职/平调/离职 |
| old_position | VARCHAR(100) | | 原PS岗位（入职时为空） |
| new_position | VARCHAR(100) | | 新PS岗位（离职时为空） |
| remark | TEXT | | 备注 |
| create_time | DATETIME | DEFAULT CURRENT_TIMESTAMP | 变动时间 |

**索引**：
- `idx_oa_number` ON (oa_number)

---

### 2.7 cert_names（证书名称字典表）

**说明**：维护标准证书名称，支持证书名称别名映射（如"大堂服务类"和"大堂经理岗"为同一证书）。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| standard_name | VARCHAR(200) | UNIQUE NOT NULL | 标准证书名称 |
| aliases | TEXT | | 别名列表，JSON数组格式 |
| remark | TEXT | | 备注 |
| create_time | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**示例数据**：
```json
{
  "standard_name": "大堂经理岗证书",
  "aliases": ["大堂服务类", "大堂经理", "大堂服务证书"]
}
```

---

## 三、核心业务计算逻辑

### 3.1 个人必考证书计算

```sql
-- 根据员工PS岗位查询必考证书
SELECT c.cert_name
FROM employees e
JOIN ps_positions p ON e.ps_position = p.position_name
JOIN position_cert_map c ON p.id = c.position_id
WHERE e.oa_number = ?
```

### 3.2 个人应考未考证书计算

```sql
-- 必考证书 - 已持有效证书 = 应考未考证书
SELECT required.cert_name
FROM (
    -- 必考证书
    SELECT c.cert_name
    FROM employees e
    JOIN ps_positions p ON e.ps_position = p.position_name
    JOIN position_cert_map c ON p.id = c.position_id
    WHERE e.oa_number = ?
) required
WHERE required.cert_name NOT IN (
    -- 已持有效证书
    SELECT cert_name FROM certificates
    WHERE oa_number = ? AND status = '有效'
)
```

### 3.3 通过人次统计

```sql
-- 统计必考证书全部覆盖的在职人员
SELECT COUNT(DISTINCT e.oa_number) as pass_count
FROM employees e
WHERE e.status = '在职'
AND NOT EXISTS (
    -- 存在未获取的必考证书
    SELECT 1 FROM (
        SELECT c.cert_name
        FROM ps_positions p
        JOIN position_cert_map c ON p.id = c.position_id
        WHERE p.position_name = e.ps_position
    ) required
    WHERE required.cert_name NOT IN (
        SELECT cert_name FROM certificates
        WHERE oa_number = e.oa_number AND status = '有效'
    )
)
```

### 3.4 应考未考人次统计

```sql
-- 统计存在至少1项必考证书未获取的在职人员
SELECT COUNT(DISTINCT e.oa_number) as unpass_count
FROM employees e
WHERE e.status = '在职'
AND e.ps_position IS NOT NULL
AND EXISTS (
    SELECT 1 FROM (
        SELECT c.cert_name
        FROM ps_positions p
        JOIN position_cert_map c ON p.id = c.position_id
        WHERE p.position_name = e.ps_position
    ) required
    WHERE required.cert_name NOT IN (
        SELECT cert_name FROM certificates
        WHERE oa_number = e.oa_number AND status = '有效'
    )
)
```

---

## 四、数据完整性保障

### 4.1 外键约束

```sql
PRAGMA foreign_keys = ON;
```

### 4.2 事务处理

所有写入操作（人员变动、证书新增、继续教育导入）均使用事务包裹，确保原子性：

```javascript
db.run('BEGIN TRANSACTION');
try {
    // 多表操作
    db.run('COMMIT');
} catch (err) {
    db.run('ROLLBACK');
    throw err;
}
```

---

## 五、数据库文件加密

使用 `sqlcipher` 扩展实现 SQLite 数据库加密：

```javascript
const db = new sqlite3.Database('data.db');
db.run(`PRAGMA key = 'your-encryption-key'`);
```

---

## 六、待确认问题

1. **证书名称别名映射**：需求提到"大堂服务类"和"大堂经理岗"是同一个证书，是否需要维护证书别名表？还是直接在导入时提示用户更正？

2. **PS岗位为空的处理**：人员导入时如果PS岗位为空，该人员的必考证书、应考未考证书如何处理？当前设计为：PS岗位为空时，必考证书和应考未考证书均为空，待后续补充岗位后自动计算。

3. **历史数据保留策略**：离职人员的数据保留多长时间？是否需要数据归档功能？

---

**请确认以上表结构设计是否符合需求，或提出修改意见。**
