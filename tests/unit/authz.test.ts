import { describe, expect, it } from 'vitest'
import { abilitiesFor, can, canAccessProject } from '@/server/authz/abilities'

describe('project abilities', () => {
  it('lets the information manager do everything', () => {
    const context = { orgRole: null, projectRole: 'INFORMATION_MANAGER' as const }
    expect(can(context, 'protocol:approve')).toBe(true)
    expect(can(context, 'settings:manage')).toBe(true)
  })

  it('lets a coordinator author the protocol but never approve it', () => {
    const context = { orgRole: null, projectRole: 'BIM_COORDINATOR' as const }
    expect(can(context, 'protocol:edit')).toBe(true)
    expect(can(context, 'naming:edit')).toBe(true)
    expect(can(context, 'protocol:approve')).toBe(false)
    expect(can(context, 'team:manage')).toBe(false)
  })

  it('limits a modeller to reading and commenting', () => {
    const context = { orgRole: null, projectRole: 'BIM_MODELLER' as const }
    expect(can(context, 'project:view')).toBe(true)
    expect(can(context, 'comment:create')).toBe(true)
    expect(can(context, 'protocol:edit')).toBe(false)
  })

  it('limits the client to reviewing and commenting', () => {
    const context = { orgRole: null, projectRole: 'CLIENT' as const }
    expect(can(context, 'protocol:review')).toBe(true)
    expect(can(context, 'protocol:edit')).toBe(false)
    expect(can(context, 'comment:resolve')).toBe(false)
  })

  it('gives a viewer read access only', () => {
    expect([...abilitiesFor({ orgRole: null, projectRole: 'VIEWER' })]).toEqual(['project:view'])
  })

  it('gives organisation owners full control regardless of project role', () => {
    const context = { orgRole: 'OWNER' as const, projectRole: 'VIEWER' as const }
    expect(can(context, 'protocol:approve')).toBe(true)
    expect(can(context, 'team:manage')).toBe(true)
  })

  it('grants the union of organisation and project abilities', () => {
    const context = { orgRole: 'MEMBER' as const, projectRole: 'BIM_COORDINATOR' as const }
    expect(can(context, 'protocol:edit')).toBe(true)
    expect(can(context, 'protocol:approve')).toBe(false)
  })

  it('denies everything to someone outside the organisation and the project', () => {
    const context = { orgRole: null, projectRole: null }
    expect(canAccessProject(context)).toBe(false)
    expect(abilitiesFor(context).size).toBe(0)
  })

  it('lets an organisation member see a project they are not assigned to', () => {
    expect(canAccessProject({ orgRole: 'MEMBER', projectRole: null })).toBe(true)
  })
})
