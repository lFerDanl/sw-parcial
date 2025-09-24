// src/diagrams/diagrams.controller.ts
import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Patch } from '@nestjs/common';
import { DiagramsService } from './diagrams.service';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';
import { Auth } from 'src/auth/decorator/auth.decorators';
import { Role } from 'src/common/enums/role.enum';
import { ActiveUser } from 'src/common/decorator/active-user.decorator';
import { ActiveUserInterface } from 'src/common/interfaces/active-user.interface';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('diagrams')
@Auth(Role.USER)
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) { }

  @Post()
  create(
    @Body() createDiagramDto: CreateDiagramDto,
    @ActiveUser() user: ActiveUserInterface,
  ) {
    return this.diagramsService.create(createDiagramDto, { id: user.sub } as any);
  }

  @Get()
  findAll(@ActiveUser() user: ActiveUserInterface) {
    return this.diagramsService.findAllByUser(user.sub);
  }

  @Get('shared')
  findShared(@ActiveUser() user: ActiveUserInterface) {
    return this.diagramsService.findShared(user.sub);
  }


  @Get(':id')
  findOne(@Param('id') id: number, @ActiveUser() user: ActiveUserInterface) {
    return this.diagramsService.findOne(id, { id: user.sub } as any);
  }

  @Patch(':id')
  @ApiBody({ type: CreateDiagramDto })
  update(
    @Param('id') id: number,
    @Body() updateDiagramDto: UpdateDiagramDto,
    @ActiveUser() user: ActiveUserInterface,
  ) {
    return this.diagramsService.update(id, updateDiagramDto, { id: user.sub } as any);
  }

  @Delete(':id')
  remove(@Param('id') id: number, @ActiveUser() user: ActiveUserInterface) {
    return this.diagramsService.remove(id, { id: user.sub } as any);
  }

  @Post(':id/share/:userId')
  shareDiagram(
    @Param('id') id: number,
    @Param('userId') userId: number,
    @ActiveUser() user: ActiveUserInterface,
  ) {
    return this.diagramsService.shareDiagram(id, userId, { id: user.sub } as any);
  }

}
