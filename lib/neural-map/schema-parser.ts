/**
 * Universal Schema Parser - Production Grade
 *
 * 지원 형식:
 * - SQL migrations (Supabase, raw SQL)
 * - Prisma schema
 * - GraphQL SDL (graphql 라이브러리 사용)
 * - OpenAPI/Swagger (js-yaml 라이브러리 사용)
 * - TypeORM entities (@babel/parser AST 사용)
 * - Drizzle schema (@babel/parser AST 사용)
 * - TypeScript interfaces/types
 */

import * as yaml from 'js-yaml'
import { parse as parseGraphQL, DocumentNode, TypeDefinitionNode, FieldDefinitionNode, NamedTypeNode, ListTypeNode, NonNullTypeNode } from 'graphql'
import * as babelParser from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

// ============================================================================
// Type Definitions
// ============================================================================

export interface SchemaColumn {
  name: string
  type: string
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  isNullable?: boolean
  isUnique?: boolean
  defaultValue?: string
  references?: {
    table: string
    column: string
  }
}

export interface SchemaTable {
  name: string
  columns: SchemaColumn[]
  source?: 'sql' | 'prisma' | 'typescript' | 'drizzle' | 'graphql' | 'openapi' | 'typeorm'
  indexes?: { name: string; columns: string[]; unique?: boolean }[]
}

export interface SchemaRelation {
  sourceTable: string
  sourceColumn: string
  targetTable: string
  targetColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

export interface ParsedSchema {
  tables: SchemaTable[]
  relations: SchemaRelation[]
  detectedType?: 'sql' | 'prisma' | 'typescript' | 'drizzle' | 'graphql' | 'openapi' | 'typeorm' | 'mixed'
  errors?: string[]
}

// ============================================================================
// SQL Parser (Enhanced)
// ============================================================================

export function parseSQLFile(content: string): ParsedSchema {
  const tables: SchemaTable[] = []
  const relations: SchemaRelation[] = []
  const errors: string[] = []

  try {
    // 주석 제거 (-- 와 /* */ 모두)
    const cleanContent = content
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')

    // CREATE TABLE 문 찾기 (멀티라인, 다양한 형식 지원)
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:public|"public")\.)?["'`]?(\w+)["'`]?\s*\(([\s\S]*?)\)\s*;/gi

    let match
    while ((match = createTableRegex.exec(cleanContent)) !== null) {
      const tableName = match[1]
      const columnsBlock = match[2]

      try {
        const { columns, tableRelations } = parseColumnsBlock(columnsBlock, tableName)

        const existingTable = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase())
        if (existingTable) {
          // 컬럼 병합
          columns.forEach(col => {
            if (!existingTable.columns.find(c => c.name === col.name)) {
              existingTable.columns.push(col)
            }
          })
        } else {
          tables.push({ name: tableName, columns, source: 'sql' })
        }

        relations.push(...tableRelations)
      } catch (e: any) {
        errors.push(`Table ${tableName}: ${e.message}`)
      }
    }

    // ALTER TABLE 처리
    parseAlterStatements(cleanContent, tables, relations, errors)

    // CREATE INDEX 처리
    parseCreateIndex(cleanContent, tables)

  } catch (e: any) {
    errors.push(`SQL Parse Error: ${e.message}`)
  }

  return { tables, relations, detectedType: 'sql', errors: errors.length > 0 ? errors : undefined }
}

function parseColumnsBlock(columnsBlock: string, tableName: string): { columns: SchemaColumn[], tableRelations: SchemaRelation[] } {
  const columns: SchemaColumn[] = []
  const tableRelations: SchemaRelation[] = []

  // 괄호 내부 콤마로 분리 (단, 함수 호출 내 콤마는 제외)
  const items = splitColumnDefinitions(columnsBlock)

  for (const item of items) {
    const trimmed = item.trim()
    if (!trimmed) continue

    // CONSTRAINT, PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK 등 테이블 레벨 제약조건
    if (/^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|EXCLUDE)/i.test(trimmed)) {
      // FOREIGN KEY 제약조건
      const fkMatch = trimmed.match(/FOREIGN\s+KEY\s*\(\s*["'`]?(\w+)["'`]?\s*\)\s*REFERENCES\s+(?:(?:public|"public")\.)?["'`]?(\w+)["'`]?\s*\(\s*["'`]?(\w+)["'`]?\s*\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i)
      if (fkMatch) {
        const sourceCol = fkMatch[1]
        const targetTable = fkMatch[2]
        const targetCol = fkMatch[3]
        const onDelete = fkMatch[4]?.replace(/\s+/g, '_').toUpperCase() as any

        // 해당 컬럼에 FK 마킹
        const col = columns.find(c => c.name === sourceCol)
        if (col) {
          col.isForeignKey = true
          col.references = { table: targetTable, column: targetCol }
        }

        tableRelations.push({
          sourceTable: tableName,
          sourceColumn: sourceCol,
          targetTable,
          targetColumn: targetCol,
          type: 'one-to-many',
          onDelete
        })
      }

      // PRIMARY KEY (컬럼 리스트)
      const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(\s*(.+?)\s*\)/i)
      if (pkMatch) {
        const pkCols = pkMatch[1].split(',').map(c => c.trim().replace(/["'`]/g, ''))
        pkCols.forEach(pkCol => {
          const col = columns.find(c => c.name === pkCol)
          if (col) col.isPrimaryKey = true
        })
      }

      // UNIQUE
      const uniqueMatch = trimmed.match(/UNIQUE\s*\(\s*(.+?)\s*\)/i)
      if (uniqueMatch) {
        const uniqueCols = uniqueMatch[1].split(',').map(c => c.trim().replace(/["'`]/g, ''))
        uniqueCols.forEach(uCol => {
          const col = columns.find(c => c.name === uCol)
          if (col) col.isUnique = true
        })
      }

      continue
    }

    // 일반 컬럼 정의
    const colMatch = trimmed.match(/^["'`]?(\w+)["'`]?\s+(.+)$/i)
    if (colMatch) {
      const column = parseColumnDefinition(colMatch[1], colMatch[2], tableName, tableRelations)
      columns.push(column)
    }
  }

  return { columns, tableRelations }
}

function splitColumnDefinitions(block: string): string[] {
  const items: string[] = []
  let current = ''
  let parenDepth = 0

  for (let i = 0; i < block.length; i++) {
    const char = block[i]
    if (char === '(') parenDepth++
    else if (char === ')') parenDepth--
    else if (char === ',' && parenDepth === 0) {
      items.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) items.push(current.trim())

  return items
}

function parseColumnDefinition(name: string, definition: string, tableName: string, relations: SchemaRelation[]): SchemaColumn {
  const def = definition.toUpperCase()

  // 타입 추출 (첫 번째 단어 또는 함수 호출)
  const typeMatch = definition.match(/^(\w+(?:\s*\([^)]+\))?(?:\s*\[\])?)/i)
  let type = typeMatch ? typeMatch[1].toLowerCase() : 'unknown'
  type = normalizeType(type)

  const column: SchemaColumn = {
    name,
    type,
    isPrimaryKey: def.includes('PRIMARY KEY'),
    isNullable: !def.includes('NOT NULL'),
    isUnique: def.includes('UNIQUE'),
  }

  // DEFAULT 값
  const defaultMatch = definition.match(/DEFAULT\s+([^,\s]+(?:\([^)]*\))?)/i)
  if (defaultMatch) {
    column.defaultValue = defaultMatch[1]
  }

  // REFERENCES (인라인 FK)
  const refMatch = definition.match(/REFERENCES\s+(?:(?:public|"public")\.)?["'`]?(\w+)["'`]?\s*\(\s*["'`]?(\w+)["'`]?\s*\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i)
  if (refMatch) {
    column.isForeignKey = true
    column.references = { table: refMatch[1], column: refMatch[2] }
    relations.push({
      sourceTable: tableName,
      sourceColumn: name,
      targetTable: refMatch[1],
      targetColumn: refMatch[2],
      type: 'one-to-many',
      onDelete: refMatch[3]?.replace(/\s+/g, '_').toUpperCase() as any
    })
  }

  return column
}

function parseAlterStatements(content: string, tables: SchemaTable[], relations: SchemaRelation[], errors: string[]) {
  // ALTER TABLE ADD COLUMN
  const addColRegex = /ALTER\s+TABLE\s+(?:(?:public|"public")\.)?["'`]?(\w+)["'`]?\s+ADD\s+(?:COLUMN\s+)?["'`]?(\w+)["'`]?\s+([^;]+)/gi
  let match
  while ((match = addColRegex.exec(content)) !== null) {
    const tableName = match[1]
    const columnName = match[2]
    const columnDef = match[3]

    let table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase())
    if (!table) {
      table = { name: tableName, columns: [], source: 'sql' }
      tables.push(table)
    }

    if (!table.columns.find(c => c.name === columnName)) {
      const column = parseColumnDefinition(columnName, columnDef, tableName, relations)
      table.columns.push(column)
    }
  }

  // ALTER TABLE ADD CONSTRAINT FOREIGN KEY
  const addFkRegex = /ALTER\s+TABLE\s+(?:(?:public|"public")\.)?["'`]?(\w+)["'`]?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(\s*["'`]?(\w+)["'`]?\s*\)\s*REFERENCES\s+(?:(?:public|"public")\.)?["'`]?(\w+)["'`]?\s*\(\s*["'`]?(\w+)["'`]?\s*\)/gi
  while ((match = addFkRegex.exec(content)) !== null) {
    const sourceTable = match[1]
    const sourceCol = match[2]
    const targetTable = match[3]
    const targetCol = match[4]

    // 중복 체크
    if (!relations.find(r =>
      r.sourceTable === sourceTable &&
      r.sourceColumn === sourceCol &&
      r.targetTable === targetTable
    )) {
      relations.push({
        sourceTable,
        sourceColumn: sourceCol,
        targetTable,
        targetColumn: targetCol,
        type: 'one-to-many'
      })

      // 컬럼에 FK 마킹
      const table = tables.find(t => t.name.toLowerCase() === sourceTable.toLowerCase())
      const col = table?.columns.find(c => c.name === sourceCol)
      if (col) {
        col.isForeignKey = true
        col.references = { table: targetTable, column: targetCol }
      }
    }
  }
}

function parseCreateIndex(content: string, tables: SchemaTable[]) {
  const indexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?\s+ON\s+(?:(?:public|"public")\.)?["'`]?(\w+)["'`]?\s*\(\s*([^)]+)\s*\)/gi
  let match
  while ((match = indexRegex.exec(content)) !== null) {
    const isUnique = !!match[1]
    const indexName = match[2]
    const tableName = match[3]
    const columnList = match[4]

    const table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase())
    if (table) {
      if (!table.indexes) table.indexes = []
      const columns = columnList.split(',').map(c => c.trim().replace(/["'`]/g, '').split(/\s+/)[0])
      table.indexes.push({ name: indexName, columns, unique: isUnique })
    }
  }
}

function normalizeType(type: string): string {
  const t = type.toLowerCase().trim()

  if (t.startsWith('character varying') || t.startsWith('varchar')) return 'varchar'
  if (t.startsWith('timestamp')) return 'timestamp'
  if (t === 'boolean' || t === 'bool') return 'boolean'
  if (t === 'integer' || t === 'int4' || t === 'int') return 'integer'
  if (t === 'bigint' || t === 'int8') return 'bigint'
  if (t === 'smallint' || t === 'int2') return 'smallint'
  if (t === 'double precision' || t === 'float8') return 'float'
  if (t === 'real' || t === 'float4') return 'float'
  if (t.startsWith('numeric') || t.startsWith('decimal')) return 'decimal'
  if (t === 'text') return 'text'
  if (t === 'uuid') return 'uuid'
  if (t === 'json' || t === 'jsonb') return 'json'
  if (t === 'date') return 'date'
  if (t === 'time') return 'time'
  if (t.includes('[]')) return t // 배열 타입 유지

  return t
}

// ============================================================================
// Prisma Parser (Enhanced)
// ============================================================================

export function parsePrismaFile(content: string): ParsedSchema {
  const tables: SchemaTable[] = []
  const relations: SchemaRelation[] = []
  const errors: string[] = []

  try {
    // 주석 제거
    const cleanContent = content.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

    // model 블록 찾기 (들여쓰기된 닫는 중괄호 허용)
    const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\s*\}/g
    let match

    while ((match = modelRegex.exec(cleanContent)) !== null) {
      const modelName = match[1]
      const fieldsBlock = match[2]
      const columns: SchemaColumn[] = []
      let tableMappedName = modelName

      const lines = fieldsBlock.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'))

      for (const line of lines) {
        // @@map - 테이블명 매핑
        const mapMatch = line.match(/@@map\s*\(\s*["'](\w+)["']\s*\)/)
        if (mapMatch) {
          tableMappedName = mapMatch[1]
          continue
        }

        // @@index, @@unique, @@id 스킵
        if (line.startsWith('@@')) continue

        // 필드 파싱
        const fieldMatch = line.match(/^(\w+)\s+(\w+)(\?)?(\[\])?\s*(.*)$/)
        if (fieldMatch) {
          const [, fieldName, fieldType, optional, isArray, attributes] = fieldMatch

          // @relation 필드 처리
          if (attributes.includes('@relation')) {
            const relationMatch = attributes.match(/@relation\s*\(\s*(?:name:\s*["'][^"']+["'],?\s*)?(?:fields:\s*\[([^\]]+)\]\s*,?\s*)?(?:references:\s*\[([^\]]+)\])?\s*\)/)
            if (relationMatch && relationMatch[1] && relationMatch[2]) {
              const sourceFields = relationMatch[1].split(',').map(f => f.trim())
              const targetFields = relationMatch[2].split(',').map(f => f.trim())

              sourceFields.forEach((sf, idx) => {
                relations.push({
                  sourceTable: tableMappedName,
                  sourceColumn: sf,
                  targetTable: fieldType,
                  targetColumn: targetFields[idx] || 'id',
                  type: isArray ? 'one-to-many' : 'one-to-one'
                })
              })
            }
            // relation 필드는 실제 컬럼이 아니므로 스킵
            if (!attributes.includes('@relation') || isArray) continue
          }

          // 실제 DB 컬럼인 경우에만 추가
          const isRelationOnly = !['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'BigInt', 'Decimal'].includes(fieldType) && !fieldName.endsWith('Id')
          if (isRelationOnly && !attributes.includes('@db.')) continue

          const column: SchemaColumn = {
            name: fieldName,
            type: fieldType.toLowerCase() + (isArray ? '[]' : ''),
            isPrimaryKey: attributes.includes('@id'),
            isForeignKey: fieldName.endsWith('Id') || attributes.includes('@relation'),
            isNullable: !!optional,
            isUnique: attributes.includes('@unique'),
          }

          // @default
          const defaultMatch = attributes.match(/@default\s*\(\s*([^)]+)\s*\)/)
          if (defaultMatch) {
            column.defaultValue = defaultMatch[1]
          }

          // @map - 컬럼명 매핑
          const colMapMatch = attributes.match(/@map\s*\(\s*["'](\w+)["']\s*\)/)
          if (colMapMatch) {
            column.name = colMapMatch[1]
          }

          // @db 타입 매핑
          const dbTypeMatch = attributes.match(/@db\.(\w+)(?:\(([^)]+)\))?/)
          if (dbTypeMatch) {
            column.type = dbTypeMatch[1].toLowerCase()
          }

          columns.push(column)
        }
      }

      tables.push({ name: tableMappedName, columns, source: 'prisma' })
    }

    // enum도 파싱 (참조용)
    // enum은 테이블이 아니므로 별도 처리 필요 시 확장

  } catch (e: any) {
    errors.push(`Prisma Parse Error: ${e.message}`)
  }

  return { tables, relations, detectedType: 'prisma', errors: errors.length > 0 ? errors : undefined }
}

// ============================================================================
// GraphQL Parser (Using graphql library)
// ============================================================================

export function parseGraphQLFile(content: string): ParsedSchema {
  const tables: SchemaTable[] = []
  const relations: SchemaRelation[] = []
  const errors: string[] = []

  try {
    const ast: DocumentNode = parseGraphQL(content)

    const excludeTypes = ['Query', 'Mutation', 'Subscription']
    const scalarTypes = ['ID', 'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Date', 'Time', 'JSON', 'Upload']

    for (const definition of ast.definitions) {
      if (definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') {
        const typeDef = definition as TypeDefinitionNode & { name: { value: string }, fields?: readonly FieldDefinitionNode[] }
        const typeName = typeDef.name.value

        if (excludeTypes.includes(typeName)) continue

        const columns: SchemaColumn[] = []

        if ('fields' in typeDef && typeDef.fields) {
          for (const field of typeDef.fields) {
            const fieldName = field.name.value
            const { typeName: fieldType, isArray, isRequired } = unwrapType(field.type)

            const isScalar = scalarTypes.includes(fieldType)

            columns.push({
              name: fieldName,
              type: isArray ? `[${fieldType}]` : fieldType,
              isPrimaryKey: fieldType === 'ID' || fieldName === 'id',
              isForeignKey: !isScalar,
              isNullable: !isRequired,
            })

            // 관계 추출
            if (!isScalar) {
              relations.push({
                sourceTable: typeName,
                sourceColumn: fieldName,
                targetTable: fieldType,
                targetColumn: 'id',
                type: isArray ? 'one-to-many' : 'one-to-one'
              })
            }
          }
        }

        if (columns.length > 0) {
          // extend type 처리
          const existing = tables.find(t => t.name === typeName)
          if (existing) {
            columns.forEach(col => {
              if (!existing.columns.find(c => c.name === col.name)) {
                existing.columns.push(col)
              }
            })
          } else {
            tables.push({ name: typeName, columns, source: 'graphql' })
          }
        }
      }

      // Interface도 처리
      if (definition.kind === 'InterfaceTypeDefinition') {
        const typeDef = definition as TypeDefinitionNode & { name: { value: string }, fields?: readonly FieldDefinitionNode[] }
        const typeName = typeDef.name.value
        const columns: SchemaColumn[] = []

        if ('fields' in typeDef && typeDef.fields) {
          for (const field of typeDef.fields) {
            const fieldName = field.name.value
            const { typeName: fieldType, isArray, isRequired } = unwrapType(field.type)

            columns.push({
              name: fieldName,
              type: isArray ? `[${fieldType}]` : fieldType,
              isPrimaryKey: fieldName === 'id',
              isNullable: !isRequired,
            })
          }
        }

        if (columns.length > 0) {
          tables.push({ name: typeName, columns, source: 'graphql' })
        }
      }
    }

  } catch (e: any) {
    errors.push(`GraphQL Parse Error: ${e.message}`)
  }

  return { tables, relations, detectedType: 'graphql', errors: errors.length > 0 ? errors : undefined }
}

function unwrapType(type: any): { typeName: string, isArray: boolean, isRequired: boolean } {
  let isArray = false
  let isRequired = false
  let current = type

  while (current) {
    if (current.kind === 'NonNullType') {
      isRequired = true
      current = current.type
    } else if (current.kind === 'ListType') {
      isArray = true
      current = current.type
    } else if (current.kind === 'NamedType') {
      return { typeName: current.name.value, isArray, isRequired }
    } else {
      break
    }
  }

  return { typeName: 'unknown', isArray, isRequired }
}

// ============================================================================
// OpenAPI/Swagger Parser (Using js-yaml)
// ============================================================================

export function parseOpenAPIFile(content: string): ParsedSchema {
  const tables: SchemaTable[] = []
  const relations: SchemaRelation[] = []
  const errors: string[] = []

  try {
    let spec: any

    // JSON 또는 YAML 파싱
    if (content.trim().startsWith('{')) {
      spec = JSON.parse(content)
    } else {
      spec = yaml.load(content) as any
    }

    if (!spec) {
      errors.push('Empty or invalid OpenAPI spec')
      return { tables, relations, detectedType: 'openapi', errors }
    }

    // OpenAPI 3.x: components.schemas
    // Swagger 2.x: definitions
    const schemas = spec?.components?.schemas || spec?.definitions || {}

    for (const [schemaName, schemaDef] of Object.entries(schemas)) {
      const schema = schemaDef as any
      if (!schema) continue

      // allOf, oneOf, anyOf 처리
      let properties = schema.properties || {}
      let required = schema.required || []

      if (schema.allOf) {
        for (const part of schema.allOf) {
          if (part.properties) {
            properties = { ...properties, ...part.properties }
          }
          if (part.required) {
            required = [...required, ...part.required]
          }
          // $ref 처리
          if (part.$ref) {
            const refName = part.$ref.split('/').pop()
            const refSchema = schemas[refName]
            if (refSchema?.properties) {
              properties = { ...refSchema.properties, ...properties }
            }
            if (refSchema?.required) {
              required = [...refSchema.required, ...required]
            }
          }
        }
      }

      if (Object.keys(properties).length === 0) continue

      const columns: SchemaColumn[] = []

      for (const [propName, propDef] of Object.entries(properties)) {
        const prop = propDef as any
        if (!prop) continue

        // $ref 처리 (관계)
        if (prop.$ref) {
          const refType = prop.$ref.split('/').pop()
          columns.push({
            name: propName,
            type: refType,
            isForeignKey: true,
            isNullable: !required.includes(propName),
          })
          relations.push({
            sourceTable: schemaName,
            sourceColumn: propName,
            targetTable: refType,
            targetColumn: 'id',
            type: 'one-to-one'
          })
          continue
        }

        // 배열 타입
        if (prop.type === 'array') {
          if (prop.items?.$ref) {
            const refType = prop.items.$ref.split('/').pop()
            columns.push({
              name: propName,
              type: `[${refType}]`,
              isForeignKey: true,
              isNullable: !required.includes(propName),
            })
            relations.push({
              sourceTable: schemaName,
              sourceColumn: propName,
              targetTable: refType,
              targetColumn: 'id',
              type: 'one-to-many'
            })
          } else {
            columns.push({
              name: propName,
              type: `[${prop.items?.type || 'any'}]`,
              isNullable: !required.includes(propName),
            })
          }
          continue
        }

        // 일반 필드
        let type = prop.type || 'any'
        if (prop.format) {
          type = prop.format // uuid, date-time, email 등
        }
        if (prop.enum) {
          type = 'enum'
        }

        columns.push({
          name: propName,
          type,
          isPrimaryKey: propName === 'id',
          isNullable: !required.includes(propName),
          defaultValue: prop.default !== undefined ? String(prop.default) : undefined,
        })
      }

      if (columns.length > 0) {
        tables.push({ name: schemaName, columns, source: 'openapi' })
      }
    }

  } catch (e: any) {
    errors.push(`OpenAPI Parse Error: ${e.message}`)
  }

  return { tables, relations, detectedType: 'openapi', errors: errors.length > 0 ? errors : undefined }
}

// ============================================================================
// TypeORM Parser (Using @babel/parser AST)
// ============================================================================

export function parseTypeORMFile(content: string): ParsedSchema {
  const tables: SchemaTable[] = []
  const relations: SchemaRelation[] = []
  const errors: string[] = []

  try {
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'decorators-legacy', 'classProperties']
    })

    traverse(ast, {
      ClassDeclaration(path) {
        let tableName: string | null = null
        let isEntity = false

        // @Entity 데코레이터 찾기
        const decorators = path.node.decorators || []
        for (const decorator of decorators) {
          if (t.isCallExpression(decorator.expression)) {
            const callee = decorator.expression.callee
            if (t.isIdentifier(callee) && callee.name === 'Entity') {
              isEntity = true
              const args = decorator.expression.arguments
              if (args.length > 0) {
                if (t.isStringLiteral(args[0])) {
                  tableName = args[0].value
                } else if (t.isObjectExpression(args[0])) {
                  for (const prop of args[0].properties) {
                    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'name') {
                      if (t.isStringLiteral(prop.value)) {
                        tableName = prop.value.value
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (!isEntity) return

        const className = path.node.id?.name || 'Unknown'
        tableName = tableName || className

        const columns: SchemaColumn[] = []

        // 클래스 바디 탐색
        for (const member of path.node.body.body) {
          if (!t.isClassProperty(member)) continue

          const propName = t.isIdentifier(member.key) ? member.key.name : null
          if (!propName) continue

          const memberDecorators = member.decorators || []
          let column: SchemaColumn | null = null

          for (const decorator of memberDecorators) {
            if (!t.isCallExpression(decorator.expression)) continue
            const callee = decorator.expression.callee
            if (!t.isIdentifier(callee)) continue

            const decoratorName = callee.name
            const args = decorator.expression.arguments

            // @PrimaryGeneratedColumn
            if (decoratorName === 'PrimaryGeneratedColumn') {
              let type = 'integer'
              if (args.length > 0 && t.isStringLiteral(args[0])) {
                type = args[0].value // 'uuid', 'increment', etc.
              }
              column = {
                name: propName,
                type,
                isPrimaryKey: true,
                isNullable: false,
              }
            }

            // @PrimaryColumn
            if (decoratorName === 'PrimaryColumn') {
              column = {
                name: propName,
                type: extractTypeFromArgs(args) || getTypeFromAnnotation(member),
                isPrimaryKey: true,
                isNullable: false,
              }
            }

            // @Column
            if (decoratorName === 'Column') {
              const options = extractColumnOptions(args)
              column = {
                name: options.name || propName,
                type: options.type || getTypeFromAnnotation(member),
                isPrimaryKey: false,
                isNullable: options.nullable ?? true,
                isUnique: options.unique ?? false,
                defaultValue: options.default,
              }
            }

            // @CreateDateColumn, @UpdateDateColumn, @DeleteDateColumn
            if (['CreateDateColumn', 'UpdateDateColumn', 'DeleteDateColumn'].includes(decoratorName)) {
              column = {
                name: propName,
                type: 'timestamp',
                isPrimaryKey: false,
                isNullable: decoratorName === 'DeleteDateColumn',
              }
            }

            // @ManyToOne, @OneToOne
            if (decoratorName === 'ManyToOne' || decoratorName === 'OneToOne') {
              const targetEntity = extractRelationTarget(args)
              if (targetEntity) {
                // JoinColumn에서 실제 컬럼명 추출
                const joinColDecorator = memberDecorators.find(d =>
                  t.isCallExpression(d.expression) &&
                  t.isIdentifier(d.expression.callee) &&
                  d.expression.callee.name === 'JoinColumn'
                )

                let joinColumnName = `${propName}Id`
                if (joinColDecorator && t.isCallExpression(joinColDecorator.expression)) {
                  const jcArgs = joinColDecorator.expression.arguments
                  if (jcArgs.length > 0 && t.isObjectExpression(jcArgs[0])) {
                    for (const prop of jcArgs[0].properties) {
                      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'name') {
                        if (t.isStringLiteral(prop.value)) {
                          joinColumnName = prop.value.value
                        }
                      }
                    }
                  }
                }

                column = {
                  name: joinColumnName,
                  type: 'uuid',
                  isPrimaryKey: false,
                  isForeignKey: true,
                  references: { table: targetEntity, column: 'id' }
                }

                relations.push({
                  sourceTable: tableName!,
                  sourceColumn: joinColumnName,
                  targetTable: targetEntity,
                  targetColumn: 'id',
                  type: decoratorName === 'OneToOne' ? 'one-to-one' : 'one-to-many'
                })
              }
            }

            // @ManyToMany
            if (decoratorName === 'ManyToMany') {
              const targetEntity = extractRelationTarget(args)
              if (targetEntity) {
                relations.push({
                  sourceTable: tableName!,
                  sourceColumn: propName,
                  targetTable: targetEntity,
                  targetColumn: 'id',
                  type: 'many-to-many'
                })
              }
              // ManyToMany는 컬럼을 생성하지 않음 (조인 테이블)
            }
          }

          if (column && !columns.find(c => c.name === column!.name)) {
            columns.push(column)
          }
        }

        if (columns.length > 0) {
          tables.push({ name: tableName, columns, source: 'typeorm' })
        }
      }
    })

  } catch (e: any) {
    errors.push(`TypeORM Parse Error: ${e.message}`)
  }

  return { tables, relations, detectedType: 'typeorm', errors: errors.length > 0 ? errors : undefined }
}

function extractTypeFromArgs(args: any[]): string | null {
  if (args.length === 0) return null

  if (t.isStringLiteral(args[0])) {
    return args[0].value
  }

  if (t.isObjectExpression(args[0])) {
    for (const prop of args[0].properties) {
      if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'type') {
        if (t.isStringLiteral(prop.value)) {
          return prop.value.value
        }
      }
    }
  }

  return null
}

function extractColumnOptions(args: any[]): { name?: string, type?: string, nullable?: boolean, unique?: boolean, default?: string } {
  const options: any = {}

  if (args.length === 0) return options

  // @Column('varchar') 형태
  if (t.isStringLiteral(args[0])) {
    options.type = args[0].value
    if (args.length > 1 && t.isObjectExpression(args[1])) {
      Object.assign(options, extractObjectProperties(args[1]))
    }
    return options
  }

  // @Column({ type: 'varchar', ... }) 형태
  if (t.isObjectExpression(args[0])) {
    return extractObjectProperties(args[0])
  }

  return options
}

function extractObjectProperties(obj: t.ObjectExpression): any {
  const result: any = {}

  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue

    const key = prop.key.name

    if (t.isStringLiteral(prop.value)) {
      result[key] = prop.value.value
    } else if (t.isBooleanLiteral(prop.value)) {
      result[key] = prop.value.value
    } else if (t.isNumericLiteral(prop.value)) {
      result[key] = prop.value.value
    } else if (t.isNullLiteral(prop.value)) {
      result[key] = null
    }
  }

  return result
}

function extractRelationTarget(args: any[]): string | null {
  if (args.length === 0) return null

  // () => Entity 형태의 arrow function
  if (t.isArrowFunctionExpression(args[0])) {
    const body = args[0].body
    if (t.isIdentifier(body)) {
      return body.name
    }
  }

  return null
}

function getTypeFromAnnotation(member: t.ClassProperty): string {
  if (member.typeAnnotation && t.isTSTypeAnnotation(member.typeAnnotation)) {
    const typeAnn = member.typeAnnotation.typeAnnotation

    if (t.isTSStringKeyword(typeAnn)) return 'string'
    if (t.isTSNumberKeyword(typeAnn)) return 'number'
    if (t.isTSBooleanKeyword(typeAnn)) return 'boolean'
    if (t.isTSTypeReference(typeAnn) && t.isIdentifier(typeAnn.typeName)) {
      return typeAnn.typeName.name.toLowerCase()
    }
  }

  return 'unknown'
}

// ============================================================================
// Drizzle Parser (Using @babel/parser AST)
// ============================================================================

export function parseDrizzleFile(content: string): ParsedSchema {
  const tables: SchemaTable[] = []
  const relations: SchemaRelation[] = []
  const errors: string[] = []

  try {
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['typescript']
    })

    traverse(ast, {
      VariableDeclarator(path) {
        const init = path.node.init
        if (!t.isCallExpression(init)) return

        const callee = init.callee
        if (!t.isIdentifier(callee)) return

        // pgTable, mysqlTable, sqliteTable
        if (!['pgTable', 'mysqlTable', 'sqliteTable'].includes(callee.name)) return

        const args = init.arguments
        if (args.length < 2) return

        // 테이블명
        let tableName = ''
        if (t.isStringLiteral(args[0])) {
          tableName = args[0].value
        } else {
          return
        }

        // 컬럼 정의 객체
        if (!t.isObjectExpression(args[1])) return

        const columns: SchemaColumn[] = []

        for (const prop of args[1].properties) {
          if (!t.isObjectProperty(prop)) continue
          if (!t.isIdentifier(prop.key)) continue

          const columnName = prop.key.name
          const columnDef = prop.value

          if (!t.isCallExpression(columnDef)) continue

          const column = parseDrizzleColumn(columnName, columnDef, tableName, relations)
          if (column) {
            columns.push(column)
          }
        }

        if (columns.length > 0) {
          tables.push({ name: tableName, columns, source: 'drizzle' })
        }
      }
    })

  } catch (e: any) {
    errors.push(`Drizzle Parse Error: ${e.message}`)
  }

  return { tables, relations, detectedType: 'drizzle', errors: errors.length > 0 ? errors : undefined }
}

function parseDrizzleColumn(name: string, expr: t.CallExpression, tableName: string, relations: SchemaRelation[]): SchemaColumn | null {
  // 체인된 메서드 호출을 풀어서 분석
  let current: t.Expression = expr
  const modifiers: string[] = []
  let baseType = ''
  let references: { table: string, column: string } | undefined

  while (t.isCallExpression(current)) {
    if (t.isMemberExpression(current.callee)) {
      const property = current.callee.property
      if (t.isIdentifier(property)) {
        const modifier = property.name
        modifiers.push(modifier)

        // .references() 처리
        if (modifier === 'references' && current.arguments.length > 0) {
          const refArg = current.arguments[0]
          if (t.isArrowFunctionExpression(refArg)) {
            const body = refArg.body
            if (t.isMemberExpression(body) && t.isIdentifier(body.object) && t.isIdentifier(body.property)) {
              references = {
                table: body.object.name,
                column: body.property.name
              }
              relations.push({
                sourceTable: tableName,
                sourceColumn: name,
                targetTable: references.table,
                targetColumn: references.column,
                type: 'one-to-many'
              })
            }
          }
        }
      }
      current = current.callee.object as t.Expression
    } else if (t.isIdentifier(current.callee)) {
      baseType = current.callee.name
      break
    } else {
      break
    }
  }

  if (!baseType) return null

  // Drizzle 타입 → SQL 타입 매핑
  const typeMap: Record<string, string> = {
    'serial': 'serial',
    'bigserial': 'bigserial',
    'integer': 'integer',
    'bigint': 'bigint',
    'smallint': 'smallint',
    'boolean': 'boolean',
    'text': 'text',
    'varchar': 'varchar',
    'char': 'char',
    'uuid': 'uuid',
    'timestamp': 'timestamp',
    'date': 'date',
    'time': 'time',
    'json': 'json',
    'jsonb': 'jsonb',
    'real': 'real',
    'doublePrecision': 'double precision',
    'numeric': 'numeric',
    'decimal': 'decimal',
  }

  return {
    name,
    type: typeMap[baseType] || baseType,
    isPrimaryKey: modifiers.includes('primaryKey'),
    isForeignKey: !!references,
    isNullable: !modifiers.includes('notNull'),
    isUnique: modifiers.includes('unique'),
    references,
    defaultValue: modifiers.includes('default') ? 'default' : undefined,
  }
}

// ============================================================================
// TypeScript Parser (Enhanced)
// ============================================================================

export function parseTypeScriptFile(content: string): ParsedSchema {
  const tables: SchemaTable[] = []
  const relations: SchemaRelation[] = []
  const errors: string[] = []

  // 기본 타입 목록 (이런 타입들은 FK 관계로 인식하지 않음)
  const primitiveTypes = new Set([
    'string', 'number', 'boolean', 'null', 'undefined', 'any', 'unknown', 'void', 'never',
    'String', 'Number', 'Boolean', 'Date', 'Object', 'Array', 'Function', 'Symbol', 'BigInt',
    'Record', 'Map', 'Set', 'Promise', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit',
  ])

  // 타입이 다른 테이블/인터페이스 참조인지 확인하는 함수
  const isTypeReference = (typeStr: string): string | null => {
    // 배열 타입에서 요소 타입 추출: "Item[]" -> "Item"
    const arrayMatch = typeStr.match(/^([A-Z][a-zA-Z0-9]*)\[\]$/)
    if (arrayMatch) {
      const elementType = arrayMatch[1]
      if (!primitiveTypes.has(elementType)) {
        return elementType
      }
    }

    // 단일 타입 참조: "Material" (PascalCase이고 primitive가 아닌 경우)
    if (/^[A-Z][a-zA-Z0-9]*$/.test(typeStr) && !primitiveTypes.has(typeStr)) {
      return typeStr
    }

    // 유니온 타입에서 타입 참조 추출: "Material | null" -> "Material"
    const unionMatch = typeStr.match(/^([A-Z][a-zA-Z0-9]*)\s*\|/)
    if (unionMatch && !primitiveTypes.has(unionMatch[1])) {
      return unionMatch[1]
    }

    return null
  }

  try {
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['typescript']
    })

    traverse(ast, {
      // interface 처리
      TSInterfaceDeclaration(path) {
        const interfaceName = path.node.id.name
        const columns: SchemaColumn[] = []

        // extends 처리
        if (path.node.extends) {
          for (const ext of path.node.extends) {
            if (t.isIdentifier(ext.expression)) {
              // 상속받은 인터페이스의 필드는 나중에 병합
            }
          }
        }

        for (const member of path.node.body.body) {
          if (!t.isTSPropertySignature(member)) continue
          if (!t.isIdentifier(member.key)) continue

          const propName = member.key.name
          const isOptional = member.optional ?? false
          const typeStr = getTSType(member.typeAnnotation)

          // 타입 참조 확인 (FK 관계)
          const referencedType = isTypeReference(typeStr)
          const isFkByName = propName.endsWith('Id') || propName.endsWith('_id')
          const isFkByType = referencedType !== null

          columns.push({
            name: propName,
            type: typeStr,
            isPrimaryKey: propName === 'id',
            isForeignKey: isFkByName || isFkByType,
            isNullable: isOptional,
          })

          // FK 관계 추론 - 이름 기반 (userId -> User)
          if (isFkByName) {
            const targetTable = propName.replace(/Id$|_id$/, '')
            const capitalizedTarget = targetTable.charAt(0).toUpperCase() + targetTable.slice(1)
            relations.push({
              sourceTable: interfaceName,
              sourceColumn: propName,
              targetTable: capitalizedTarget,
              targetColumn: 'id',
              type: 'one-to-many'
            })
          }
          // FK 관계 추론 - 타입 참조 기반 (material: Material -> Material)
          else if (referencedType) {
            relations.push({
              sourceTable: interfaceName,
              sourceColumn: propName,
              targetTable: referencedType,
              targetColumn: 'id',
              type: typeStr.endsWith('[]') ? 'one-to-many' : 'many-to-one'
            })
          }
        }

        // 최소 2개 이상의 필드가 있는 경우만 추가
        if (columns.length >= 2) {
          tables.push({ name: interfaceName, columns, source: 'typescript' })
        }
      },

      // type alias 처리
      TSTypeAliasDeclaration(path) {
        const typeName = path.node.id.name
        const typeAnn = path.node.typeAnnotation

        if (!t.isTSTypeLiteral(typeAnn)) return

        const columns: SchemaColumn[] = []

        for (const member of typeAnn.members) {
          if (!t.isTSPropertySignature(member)) continue
          if (!t.isIdentifier(member.key)) continue

          const propName = member.key.name
          const isOptional = member.optional ?? false
          const typeStr = getTSType(member.typeAnnotation)

          // 타입 참조 확인 (FK 관계)
          const referencedType = isTypeReference(typeStr)
          const isFkByName = propName.endsWith('Id') || propName.endsWith('_id')
          const isFkByType = referencedType !== null

          columns.push({
            name: propName,
            type: typeStr,
            isPrimaryKey: propName === 'id',
            isForeignKey: isFkByName || isFkByType,
            isNullable: isOptional,
          })

          // FK 관계 추론 - 이름 기반 (userId -> User)
          if (isFkByName) {
            const targetTable = propName.replace(/Id$|_id$/, '')
            const capitalizedTarget = targetTable.charAt(0).toUpperCase() + targetTable.slice(1)
            relations.push({
              sourceTable: typeName,
              sourceColumn: propName,
              targetTable: capitalizedTarget,
              targetColumn: 'id',
              type: 'one-to-many'
            })
          }
          // FK 관계 추론 - 타입 참조 기반 (material: Material -> Material)
          else if (referencedType) {
            relations.push({
              sourceTable: typeName,
              sourceColumn: propName,
              targetTable: referencedType,
              targetColumn: 'id',
              type: typeStr.endsWith('[]') ? 'one-to-many' : 'many-to-one'
            })
          }
        }

        if (columns.length >= 2) {
          tables.push({ name: typeName, columns, source: 'typescript' })
        }
      }
    })

  } catch (e: any) {
    errors.push(`TypeScript Parse Error: ${e.message}`)
  }

  return { tables, relations, detectedType: 'typescript', errors: errors.length > 0 ? errors : undefined }
}

function getTSType(typeAnn: t.TSTypeAnnotation | null | undefined): string {
  if (!typeAnn || !t.isTSTypeAnnotation(typeAnn)) return 'unknown'

  const type = typeAnn.typeAnnotation

  if (t.isTSStringKeyword(type)) return 'string'
  if (t.isTSNumberKeyword(type)) return 'number'
  if (t.isTSBooleanKeyword(type)) return 'boolean'
  if (t.isTSNullKeyword(type)) return 'null'
  if (t.isTSUndefinedKeyword(type)) return 'undefined'
  if (t.isTSAnyKeyword(type)) return 'any'
  if (t.isTSUnknownKeyword(type)) return 'unknown'
  if (t.isTSVoidKeyword(type)) return 'void'

  if (t.isTSArrayType(type)) {
    return getTSType({ typeAnnotation: type.elementType } as any) + '[]'
  }

  if (t.isTSTypeReference(type) && t.isIdentifier(type.typeName)) {
    return type.typeName.name
  }

  if (t.isTSUnionType(type)) {
    return type.types.map(t => getTSType({ typeAnnotation: t } as any)).join(' | ')
  }

  if (t.isTSLiteralType(type)) {
    if (t.isStringLiteral(type.literal)) return `'${type.literal.value}'`
    if (t.isNumericLiteral(type.literal)) return String(type.literal.value)
    if (t.isBooleanLiteral(type.literal)) return String(type.literal.value)
  }

  return 'unknown'
}

// ============================================================================
// Schema Merger
// ============================================================================

export function mergeSchemas(schemas: ParsedSchema[]): ParsedSchema {
  const tableMap = new Map<string, SchemaTable>()
  const relationSet = new Set<string>()
  const relations: SchemaRelation[] = []
  const errors: string[] = []

  for (const schema of schemas) {
    if (schema.errors) errors.push(...schema.errors)

    // 테이블 병합
    for (const table of schema.tables) {
      const key = table.name.toLowerCase()
      const existing = tableMap.get(key)

      if (existing) {
        // 컬럼 병합
        for (const col of table.columns) {
          if (!existing.columns.find(c => c.name === col.name)) {
            existing.columns.push(col)
          }
        }
        // 인덱스 병합
        if (table.indexes) {
          if (!existing.indexes) existing.indexes = []
          for (const idx of table.indexes) {
            if (!existing.indexes.find(i => i.name === idx.name)) {
              existing.indexes.push(idx)
            }
          }
        }
      } else {
        tableMap.set(key, { ...table, columns: [...table.columns] })
      }
    }

    // 관계 병합 (중복 제거)
    for (const rel of schema.relations) {
      const key = `${rel.sourceTable.toLowerCase()}.${rel.sourceColumn}->${rel.targetTable.toLowerCase()}.${rel.targetColumn}`
      if (!relationSet.has(key)) {
        relationSet.add(key)
        relations.push(rel)
      }
    }
  }

  return {
    tables: Array.from(tableMap.values()),
    relations,
    errors: errors.length > 0 ? errors : undefined
  }
}

// ============================================================================
// Main Parser - Auto Detection
// ============================================================================

export function parseProjectSchema(files: { name: string; path?: string; content?: string }[]): ParsedSchema {
  const allSchemas: ParsedSchema[] = []
  const detectedTypes = new Set<string>()

  // 1. Prisma 스키마 (최우선)
  const prismaFile = files.find(f =>
    (f.name === 'schema.prisma' || f.path?.includes('prisma/schema.prisma')) && f.content
  )
  if (prismaFile?.content) {
    const schema = parsePrismaFile(prismaFile.content)
    if (schema.tables.length > 0) {
      allSchemas.push(schema)
      detectedTypes.add('prisma')
    }
  }

  // 2. SQL 마이그레이션
  const sqlFiles = files
    .filter(f => f.name.endsWith('.sql') && f.content)
    .sort((a, b) => a.name.localeCompare(b.name))

  if (sqlFiles.length > 0) {
    const schemas = sqlFiles.map(f => parseSQLFile(f.content!))
    const merged = mergeSchemas(schemas)
    if (merged.tables.length > 0) {
      merged.detectedType = 'sql'
      merged.tables.forEach(t => t.source = 'sql')
      allSchemas.push(merged)
      detectedTypes.add('sql')
    }
  }

  // 3. GraphQL SDL
  const graphqlFiles = files.filter(f =>
    (f.name.endsWith('.graphql') || f.name.endsWith('.gql')) && f.content
  )
  for (const file of graphqlFiles) {
    const schema = parseGraphQLFile(file.content!)
    if (schema.tables.length > 0) {
      allSchemas.push(schema)
      detectedTypes.add('graphql')
    }
  }

  // 4. OpenAPI/Swagger
  const openapiFiles = files.filter(f =>
    (f.name === 'openapi.yaml' || f.name === 'openapi.yml' ||
     f.name === 'swagger.yaml' || f.name === 'swagger.yml' ||
     f.name === 'openapi.json' || f.name === 'swagger.json' ||
     f.name.includes('api-spec')) && f.content
  )
  for (const file of openapiFiles) {
    const schema = parseOpenAPIFile(file.content!)
    if (schema.tables.length > 0) {
      allSchemas.push(schema)
      detectedTypes.add('openapi')
    }
  }

  // 5. TypeORM 엔티티
  const typeormFiles = files.filter(f =>
    f.name.endsWith('.ts') &&
    f.content &&
    f.content.includes('@Entity') &&
    (f.path?.includes('entities') || f.path?.includes('entity') || f.path?.includes('models') || f.name.includes('.entity.'))
  )
  for (const file of typeormFiles) {
    const schema = parseTypeORMFile(file.content!)
    if (schema.tables.length > 0) {
      allSchemas.push(schema)
      detectedTypes.add('typeorm')
    }
  }

  // 6. Drizzle 스키마
  const drizzleFiles = files.filter(f =>
    f.name.endsWith('.ts') &&
    f.content &&
    (f.content.includes('pgTable') || f.content.includes('mysqlTable') || f.content.includes('sqliteTable'))
  )
  for (const file of drizzleFiles) {
    const schema = parseDrizzleFile(file.content!)
    if (schema.tables.length > 0) {
      allSchemas.push(schema)
      detectedTypes.add('drizzle')
    }
  }

  // 7. TypeScript 타입 (폴백)
  if (allSchemas.length === 0 || detectedTypes.size === 0) {
    const tsFiles = files.filter(f =>
      (f.name.endsWith('.ts') || f.name.endsWith('.tsx')) &&
      f.content &&
      (f.path?.includes('types') || f.path?.includes('models') || f.path?.includes('entities') ||
       f.name.includes('type') || f.name.includes('model') || f.name.includes('schema'))
    )
    for (const file of tsFiles) {
      const schema = parseTypeScriptFile(file.content!)
      if (schema.tables.length > 0) {
        allSchemas.push(schema)
        detectedTypes.add('typescript')
      }
    }
  }

  // 결과 없음
  if (allSchemas.length === 0) {
    return { tables: [], relations: [] }
  }

  // 병합
  const merged = mergeSchemas(allSchemas)
  merged.detectedType = detectedTypes.size > 1 ? 'mixed' : (Array.from(detectedTypes)[0] as any)

  return merged
}
