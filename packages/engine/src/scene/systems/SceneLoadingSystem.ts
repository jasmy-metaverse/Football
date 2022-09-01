import { cloneDeep } from 'lodash'
import { MathUtils, Vector3 } from 'three'

import { ComponentJson, EntityJson, SceneJson } from '@xrengine/common/src/interfaces/SceneInterface'
import { dispatchAction } from '@xrengine/hyperflux'

import { Engine } from '../../ecs/classes/Engine'
import { EngineActions } from '../../ecs/classes/EngineState'
import { Entity } from '../../ecs/classes/Entity'
import { EntityTreeNode } from '../../ecs/classes/EntityTree'
import { World } from '../../ecs/classes/World'
import {
  addComponent,
  ComponentMap,
  defineQuery,
  getComponent,
  hasComponent
} from '../../ecs/functions/ComponentFunctions'
import { unloadScene } from '../../ecs/functions/EngineFunctions'
import { createEntity } from '../../ecs/functions/EntityFunctions'
import { addEntityNodeInTree, createEntityNode } from '../../ecs/functions/EntityTreeFunctions'
import { initSystems, SystemModuleType } from '../../ecs/functions/SystemFunctions'
import { SCENE_COMPONENT_TRANSFORM } from '../../transform/components/TransformComponent'
import { NameComponent } from '../components/NameComponent'
import { Object3DComponent } from '../components/Object3DComponent'
import { SceneAssetPendingTagComponent } from '../components/SceneAssetPendingTagComponent'
import { SCENE_COMPONENT_DYNAMIC_LOAD } from '../components/SceneDynamicLoadTagComponent'
import { SceneTagComponent } from '../components/SceneTagComponent'
import { VisibleComponent } from '../components/VisibleComponent'
import { ObjectLayers } from '../constants/ObjectLayers'
import { resetEngineRenderer } from '../functions/loaders/RenderSettingsFunction'

export const createNewEditorNode = (entityNode: EntityTreeNode, prefabType: string): void => {
  const components = Engine.instance.currentWorld.scenePrefabRegistry.get(prefabType)
  if (!components) return console.warn(`[createNewEditorNode]: ${prefabType} is not a prefab`)

  // Clone the defualt values so that it will not be bound to newly created node
  loadSceneEntity(entityNode, { name: prefabType, components: cloneDeep(components) })
}

export const splitLazyLoadedSceneEntities = (json: SceneJson) => {
  const entityLoadQueue = {} as { [uuid: string]: EntityJson }
  const entityDynamicQueue = {} as { [uuid: string]: EntityJson }
  for (const [uuid, entity] of Object.entries(json.entities)) {
    if (entity.components.find((comp) => comp.name === SCENE_COMPONENT_DYNAMIC_LOAD)) entityDynamicQueue[uuid] = entity
    else entityLoadQueue[uuid] = entity
  }
  return {
    entityLoadQueue,
    entityDynamicQueue
  }
}

const iterateReplaceID = (data: any, idMap: Map<string, string>) => {
  const frontier = [data]
  const changes: { obj: Object; property: string; nu: string }[] = []
  while (frontier.length > 0) {
    const item = frontier.pop()
    Object.entries(item).forEach(([key, val]) => {
      if (val && typeof val === 'object') {
        frontier.push(val)
      }
      if (typeof val === 'string' && idMap.has(val)) {
        changes.push({ obj: item, property: key, nu: idMap.get(val)! })
      }
    })
  }
  for (const change of changes) {
    change.obj[change.property] = change.nu
  }
  return data
}

export const loadECSData = async (sceneData: SceneJson, assetRoot = undefined): Promise<EntityTreeNode[]> => {
  const entityMap = {} as { [key: string]: EntityTreeNode }
  const entities = Object.entries(sceneData.entities).filter(([uuid]) => uuid !== sceneData.root)
  const idMap = new Map<string, string>()
  const loadedEntities = Engine.instance.currentWorld.entityTree.uuidNodeMap

  const root = Engine.instance.currentWorld.entityTree.rootNode
  const rootId = sceneData.root

  entities.forEach(([_uuid]) => {
    //check if uuid already exists in scene
    let uuid = _uuid
    if (loadedEntities.has(uuid)) {
      uuid = MathUtils.generateUUID()
      idMap.set(_uuid, uuid)
    }
    entityMap[uuid] = createEntityNode(createEntity(), uuid)
  })
  entities.forEach(([_uuid, _data]) => {
    let uuid = _uuid
    if (idMap.has(uuid)) {
      uuid = idMap.get(uuid)!
    }
    const data = iterateReplaceID(_data, idMap)
    loadSceneEntity(entityMap[uuid], data)
  })
  const result = new Array()
  entities.forEach(([_uuid, data]) => {
    let uuid = _uuid
    if (idMap.has(uuid)) {
      uuid = idMap.get(uuid)!
    }
    const sceneEntity = data
    const node = entityMap[uuid]
    let parentId = sceneEntity.parent
    if (parentId) {
      if (idMap.has(parentId)) parentId = idMap.get(parentId)!
      if (parentId === sceneData.root) {
        sceneEntity.parent = root.uuid
        parentId = root.uuid
        result.push(node)
      }
    }
    addEntityNodeInTree(node, parentId ? (parentId === root.uuid ? root : entityMap[parentId]) : undefined)
  })
  return result
}

/**
 * Loads a scene from scene json
 * @param sceneData
 */
export const loadSceneFromJSON = async (sceneData: SceneJson, sceneSystems: SystemModuleType<any>[]) => {
  const world = Engine.instance.currentWorld

  EngineActions.sceneLoadingProgress({ progress: 0 })

  unloadScene(world)

  await initSystems(world, sceneSystems)

  const loadedEntities = [] as Array<Entity>

  // reset renderer settings for if we are teleporting and the new scene does not have an override
  resetEngineRenderer(true)

  const { entityLoadQueue, entityDynamicQueue } = splitLazyLoadedSceneEntities(sceneData)

  const entitiesToLoad = Engine.instance.isEditor ? sceneData.entities : entityLoadQueue

  for (const [key, val] of Object.entries(entitiesToLoad)) {
    loadedEntities.push(createSceneEntity(world, key, val))
  }

  if (!Engine.instance.isEditor) {
    for (const key of Object.keys(entityDynamicQueue)) {
      const entity = entityDynamicQueue[key]
      const transform = entity.components.find((comp) => comp.name === SCENE_COMPONENT_TRANSFORM)
      const dynamicLoad = entity.components.find((comp) => comp.name === SCENE_COMPONENT_DYNAMIC_LOAD)!
      if (transform) {
        world.sceneDynamicallyUnloadedEntities.set(key, {
          json: entity,
          position: new Vector3().copy(transform.props.position),
          distance: dynamicLoad.props.distance * dynamicLoad.props.distance
        })
      } else {
        console.error('[SceneLoading]: Tried to lazily load scene object without a transform')
      }
    }
  }

  const tree = world.entityTree
  addComponent(tree.rootNode.entity, SceneTagComponent, true)

  if (!sceneAssetPendingTagQuery().length) {
    onAllSceneAssetsSettled(world)
  }
}

/**
 * Creates a scene entity and loads the data for it
 */
export const createSceneEntity = (world: World, uuid: string, json: EntityJson) => {
  const node = createEntityNode(createEntity(), uuid)
  addEntityNodeInTree(node, json.parent ? world.entityTree.uuidNodeMap.get(json.parent) : undefined)
  loadSceneEntity(node, json)
  return node.entity
}

/**
 * Loads all the components from scene json for an entity
 * @param {EntityTreeNode} entityNode
 * @param {EntityJson} sceneEntity
 */
export const loadSceneEntity = (entityNode: EntityTreeNode, sceneEntity: EntityJson): Entity => {
  addComponent(entityNode.entity, NameComponent, { name: sceneEntity.name })

  for (const component of sceneEntity.components) {
    try {
      loadComponent(entityNode.entity, component)
    } catch (e) {
      console.error(`Error loading scene entity: `, JSON.stringify(sceneEntity, null, '\t'))
      console.error(e)
    }
  }

  if (!hasComponent(entityNode.entity, VisibleComponent)) {
    const obj = getComponent(entityNode.entity, Object3DComponent)?.value
    if (obj) obj.visible = false
  }

  return entityNode.entity
}

export const loadComponent = (entity: Entity, component: ComponentJson, world = Engine.instance.currentWorld): void => {
  const sceneComponent = world.sceneLoadingRegistry.get(component.name)

  if (!sceneComponent) return

  const deserializer = sceneComponent.deserialize

  if (deserializer) {
    deserializer(entity, component.props)
  } else {
    const Component = Array.from(Engine.instance.currentWorld.sceneComponentRegistry).find(
      ([_, prefab]) => prefab === component.name
    )!
    if (!Component[0]) return console.warn('[ SceneLoading] could not find component name', Component)
    if (!ComponentMap.get(Component[0])) return console.warn('[ SceneLoading] could not find component', Component[0])

    const isTagComponent = !sceneComponent.defaultData
    addComponent(
      entity,
      ComponentMap.get(Component[0]),
      isTagComponent ? true : { ...sceneComponent.defaultData, ...component.props }
    )
  }
}

export const onAllSceneAssetsSettled = (world: World) => {
  world.camera?.layers.enable(ObjectLayers.Scene)
  dispatchAction(EngineActions.sceneLoaded({}))
  // DependencyTree.activate()
}

const sceneAssetPendingTagQuery = defineQuery([SceneAssetPendingTagComponent])
export default async function SceneLoadingSystem(world: World) {
  let totalPendingAssets = 0

  const onComplete = (pendingAssets: number) => {
    const promisesCompleted = totalPendingAssets - pendingAssets
    dispatchAction(
      EngineActions.sceneLoadingProgress({
        progress:
          promisesCompleted > totalPendingAssets ? 100 : Math.round((100 * promisesCompleted) / totalPendingAssets)
      })
    )
  }

  return () => {
    const pendingAssets = sceneAssetPendingTagQuery().length

    for (const entity of sceneAssetPendingTagQuery.enter()) {
      totalPendingAssets++
    }

    for (const entity of sceneAssetPendingTagQuery.exit()) {
      onComplete(pendingAssets)
      if (pendingAssets === 0) {
        totalPendingAssets = 0
        onAllSceneAssetsSettled(world)
      }
    }
  }
}