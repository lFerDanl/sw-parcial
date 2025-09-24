// src/diagrams/diagrams.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diagram } from './entities/diagram.entity';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { User } from 'src/users/entities/user.entity';
import { UpdateDiagramDto } from './dto/update-diagram.dto';

@Injectable()
export class DiagramsService {
  constructor(
    @InjectRepository(Diagram)
    private readonly diagramsRepository: Repository<Diagram>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) { }

  async create(createDiagramDto: CreateDiagramDto, user: User) {
    const diagram = this.diagramsRepository.create({
      ...createDiagramDto,
      owner: user,
    });
    return this.diagramsRepository.save(diagram);
  }

  async findAllByUser(userId: number) {
    return this.diagramsRepository.find({
      where: [{ owner: { id: userId } }],
      relations: ['owner'],
    });
  }

  async findShared(userId: number) {
    return this.diagramsRepository
      .createQueryBuilder("diagram")
      .leftJoinAndSelect("diagram.owner", "owner")
      .leftJoinAndSelect("diagram.sharedWith", "sharedWith")
      .where("sharedWith.id = :userId", { userId })
      .getMany();
  }

  async findOne(id: number, user: User) {
    const diagram = await this.diagramsRepository.findOne({
      where: { id },
      relations: ['owner', 'sharedWith'],
    });
    if (!diagram) throw new NotFoundException('Diagram not found');
    const hasAccess =
      diagram.owner.id === user.id ||
      diagram.sharedWith.some((u) => u.id === user.id);
    if (!hasAccess) throw new ForbiddenException('Access denied');
    return diagram;
  }

  async update(id: number, updateDiagramDto: UpdateDiagramDto, user: User) {
    const diagram = await this.findOne(id, user);
    Object.assign(diagram, updateDiagramDto);
    return this.diagramsRepository.save(diagram);
  }

  async remove(id: number, user: User) {
    const diagram = await this.findOne(id, user);
    return this.diagramsRepository.softRemove(diagram);
  }

  async shareDiagram(diagramId: number, userId: number, owner: User) {
    const diagram = await this.findOne(diagramId, owner);
    if (diagram.owner.id !== owner.id) {
      throw new ForbiddenException('Only the owner can share the diagram');
    }

    const userToShare = await this.usersRepository.findOneBy({ id: userId });
    if (!userToShare) throw new NotFoundException('User to share not found');

    diagram.sharedWith.push(userToShare);
    return this.diagramsRepository.save(diagram);
  }

  // --------------------------------------
  // Actualización parcial de elementos
  // --------------------------------------
  async updateElement(diagramId: number, elementId: string, elementData: any, user: User) {
    const diagram = await this.findOne(diagramId, user);
    if (!diagram.content.elements) diagram.content.elements = {};
    diagram.content.elements[elementId] = {
      ...diagram.content.elements[elementId],
      ...elementData,
    };
    return this.diagramsRepository.save(diagram);
  }

  // --------------------------------------
  // Mover elemento (solo posición)
  // --------------------------------------
  async moveElement(diagramId: number, elementId: string, position: { x: number; y: number }, user: User) {
    return this.updateElement(diagramId, elementId, { position }, user);
  }

  // --------------------------------------
  // Agregar un atributo a una clase
  // --------------------------------------
  async addAttribute(
    diagramId: number,
    classId: string,
    attribute: { name: string; type: string },
    user: User,
  ) {
    const diagram = await this.findOne(diagramId, user);
    if (!diagram.content.elements?.[classId]) {
      throw new NotFoundException('Class not found in diagram');
    }
    if (!diagram.content.elements[classId].attributes) {
      diagram.content.elements[classId].attributes = [];
    }
    diagram.content.elements[classId].attributes.push(attribute);
    return this.diagramsRepository.save(diagram);
  }

  // --------------------------------------
  // Editar un atributo de una clase
  // --------------------------------------
  async updateAttribute(
    diagramId: number,
    classId: string,
    attrIndex: number,
    newData: { name?: string; type?: string },
    user: User,
  ) {
    const diagram = await this.findOne(diagramId, user);
    const classElem = diagram.content.elements?.[classId];
    if (!classElem || !classElem.attributes?.[attrIndex]) {
      throw new NotFoundException('Attribute not found');
    }
    classElem.attributes[attrIndex] = { ...classElem.attributes[attrIndex], ...newData };
    return this.diagramsRepository.save(diagram);
  }

  // --------------------------------------
  // Eliminar un atributo de una clase
  // --------------------------------------
  async removeAttribute(
    diagramId: number,
    classId: string,
    attrIndex: number,
    user: User,
  ) {
    const diagram = await this.findOne(diagramId, user);
    const classElem = diagram.content.elements?.[classId];
    if (!classElem || !classElem.attributes?.[attrIndex]) {
      throw new NotFoundException('Attribute not found');
    }
    classElem.attributes.splice(attrIndex, 1);
    return this.diagramsRepository.save(diagram);
  }
  // --------------------------------------
  // Agregar una clase
  // --------------------------------------
  async addClass(
    diagramId: number,
    classId: string,
    classData: { name: string; position: { x: number; y: number }; attributes?: any[] },
    user: User,
  ) {
    const diagram = await this.findOne(diagramId, user);
    if (!diagram.content.elements) diagram.content.elements = {};
    if (diagram.content.elements[classId]) {
      throw new Error('Class already exists');
    }
    diagram.content.elements[classId] = { ...classData, attributes: classData.attributes || [] };
    return this.diagramsRepository.save(diagram);
  }

  // --------------------------------------
  // Eliminar una clase
  // --------------------------------------
  async removeClass(
    diagramId: number,
    classId: string,
    user: User,
  ) {
    const diagram = await this.findOne(diagramId, user);
    if (!diagram.content.elements?.[classId]) {
      throw new Error('Class not found');
    }

    // Eliminar relaciones asociadas a esta clase
    if (diagram.content.relations) {
      for (const relId of Object.keys(diagram.content.relations)) {
        const rel = diagram.content.relations[relId];
        if (rel.from === classId || rel.to === classId) {
          delete diagram.content.relations[relId];
        }
      }
    }

    delete diagram.content.elements[classId];
    return this.diagramsRepository.save(diagram);
  }

  // --------------------------------------
  // Crear relación
  // --------------------------------------
  async addRelation(
    diagramId: number,
    relationId: string,
    relationData: { from: string; to: string; type: string },
    user: User,
  ) {
    const diagram = await this.findOne(diagramId, user);
    if (!diagram.content.relations) diagram.content.relations = {};
    if (diagram.content.relations[relationId]) {
      throw new Error('Relation already exists');
    }
    diagram.content.relations[relationId] = relationData;
    return this.diagramsRepository.save(diagram);
  }

  // --------------------------------------
  // Actualizar relación
  // --------------------------------------
  async updateRelation(
    diagramId: number,
    relationId: string,
    relationData: Partial<{ from: string; to: string; type: string }>,
    user: User,
  ) {
    const diagram = await this.findOne(diagramId, user);
    if (!diagram.content.relations?.[relationId]) {
      throw new Error('Relation not found');
    }
    diagram.content.relations[relationId] = {
      ...diagram.content.relations[relationId],
      ...relationData,
    };
    return this.diagramsRepository.save(diagram);
  }

  // --------------------------------------
  // Eliminar relación
  // --------------------------------------
  async removeRelation(diagramId: number, relationId: string, user: User) {
    const diagram = await this.findOne(diagramId, user);
    if (!diagram.content.relations?.[relationId]) {
      throw new Error('Relation not found');
    }
    delete diagram.content.relations[relationId];
    return this.diagramsRepository.save(diagram);
  }
}
