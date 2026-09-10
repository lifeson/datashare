import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: this.normalizeEmail(email) }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  create(data: CreateUserData): Promise<UserDocument> {
    const user = new this.userModel({
      email: this.normalizeEmail(data.email),
      passwordHash: data.passwordHash,
      name: data.name?.trim() || undefined,
    });
    return user.save();
  }
}
