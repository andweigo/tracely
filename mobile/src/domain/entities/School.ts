import { BaseEntity } from '../base/BaseEntity';

export interface SchoolProps {
  id: string;
  depedSchoolId: string;
  name: string;
  district: string;
  municipality: string;
  createdAt?: string;
}

/**
 * External branch / site directory entry attached to incoming documents.
 */
export class School extends BaseEntity {
  private readonly _depedSchoolId: string;
  private readonly _name: string;
  private readonly _district: string;
  private readonly _municipality: string;

  constructor(props: SchoolProps) {
    super(props.id, props.createdAt);
    this._depedSchoolId = BaseEntity.requireNonEmpty(props.depedSchoolId, 'depedSchoolId');
    this._name = BaseEntity.requireNonEmpty(props.name, 'name');
    this._district = BaseEntity.requireNonEmpty(props.district, 'district');
    this._municipality = BaseEntity.requireNonEmpty(props.municipality, 'municipality');
  }

  public get depedSchoolId(): string {
    return this._depedSchoolId;
  }
  public get name(): string {
    return this._name;
  }
  public get district(): string {
    return this._district;
  }
  public get municipality(): string {
    return this._municipality;
  }
}
