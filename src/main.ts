import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { StayViewComponent } from './app/components/stay-view/stay-view.component';

bootstrapApplication(StayViewComponent, appConfig)
  .catch((err) => console.error(err));
