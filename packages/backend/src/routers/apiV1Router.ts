import express from 'express';
import passport from 'passport';
import { lightdashConfig } from '../config/lightdashConfig';
import {
    redirectOIDCFailure,
    redirectOIDCSuccess,
    storeOIDCRedirect,
} from '../controllers/authentication';
import { userModel } from '../models/models';
import { UserModel } from '../models/UserModel';
import { healthService, userService } from '../services/services';
import { analyticsRouter } from './analyticsRouter';
import { dashboardRouter } from './dashboardRouter';
import { headlessBrowserRouter } from './headlessBrowser';
import { inviteLinksRouter } from './inviteLinksRouter';
import { jobsRouter } from './jobsRouter';
import { organizationRouter } from './organizationRouter';
import { passwordResetLinksRouter } from './passwordResetLinksRouter';
import { projectRouter } from './projectRouter';
import { savedChartRouter } from './savedChartRouter';
import { slackRouter } from './slackRouter';
import { userRouter } from './userRouter';

export const apiV1Router = express.Router();

apiV1Router.get('/livez', async (req, res, next) => {
    res.json({
        status: 'ok',
    });
});

apiV1Router.get('/health', async (req, res, next) => {
    healthService
        .getHealthState(!!req.user?.userUuid)
        .then((state) =>
            res.json({
                status: 'ok',
                results: state,
            }),
        )
        .catch(next);
});

apiV1Router.get('/flash', (req, res) => {
    res.json({
        status: 'ok',
        results: req.flash(),
    });
});

apiV1Router.post('/login', passport.authenticate('local'), (req, res, next) => {
    req.session.save((err) => {
        if (err) {
            next(err);
        } else {
            res.json({
                status: 'ok',
                results: UserModel.lightdashUserFromSession(req.user!),
            });
        }
    });
});

apiV1Router.get(
    lightdashConfig.auth.okta.loginPath,
    storeOIDCRedirect,
    passport.authenticate('okta', {
        scope: ['openid', 'profile', 'email'],
    }),
);

apiV1Router.get(
    lightdashConfig.auth.okta.callbackPath,
    passport.authenticate('okta', {
        failureRedirect: '/api/v1/oauth/failure',
        successRedirect: '/api/v1/oauth/success',
        failureFlash: true,
    }),
);

apiV1Router.get(
    lightdashConfig.auth.azuread.loginPath,
    storeOIDCRedirect,
    passport.authenticate('azuread', {
        scope: ['openid', 'profile', 'email'],
    }),
);

apiV1Router.get(
    lightdashConfig.auth.azuread.callbackPath,
    passport.authenticate('azuread', {
        failureRedirect: '/api/v1/oauth/failure',
        successRedirect: '/api/v1/oauth/success',
        failureFlash: true,
    }),
);

apiV1Router.get(
    lightdashConfig.auth.oneLogin.loginPath,
    storeOIDCRedirect,
    passport.authenticate('oneLogin', {
        scope: ['openid', 'profile', 'email'],
    }),
);

apiV1Router.get(
    lightdashConfig.auth.oneLogin.callbackPath,
    passport.authenticate('oneLogin', {
        failureRedirect: '/api/v1/oauth/failure',
        successRedirect: '/api/v1/oauth/success',
        failureFlash: true,
    }),
);

apiV1Router.get(
    lightdashConfig.auth.google.loginPath,
    storeOIDCRedirect,
    passport.authenticate('google', {
        scope: ['profile', 'email'],
    }),
);
apiV1Router.get(
    '/login/gdrive',
    storeOIDCRedirect,
    passport.authenticate('google', {
        scope: [
            'profile',
            'email',
            'https://www.googleapis.com/auth/drive.metadata.readonly',
            'https://www.googleapis.com/auth/spreadsheets',
        ],
        accessType: 'offline',
        prompt: 'consent',
        session: false,
        includeGrantedScopes: true,
    }),
);

apiV1Router.get(
    lightdashConfig.auth.google.callbackPath,
    passport.authenticate('google', {
        failureRedirect: '/api/v1/oauth/failure',
        successRedirect: '/api/v1/oauth/success',
        failureFlash: true,
        includeGrantedScopes: true,
    }),
);
apiV1Router.get('/oauth/failure', redirectOIDCFailure);
apiV1Router.get('/oauth/success', redirectOIDCSuccess);

apiV1Router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        return req.session.destroy((err2) => {
            if (err2) {
                next(err2);
            } else {
                res.json({
                    status: 'ok',
                });
            }
        });
    });
});

apiV1Router.use('/saved', savedChartRouter);
apiV1Router.use('/invite-links', inviteLinksRouter);
apiV1Router.use('/org', organizationRouter);
apiV1Router.use('/user', userRouter);
apiV1Router.use('/projects/:projectUuid', projectRouter);
apiV1Router.use('/dashboards', dashboardRouter);
apiV1Router.use('/password-reset', passwordResetLinksRouter);
apiV1Router.use('/jobs', jobsRouter);
apiV1Router.use('/slack', slackRouter);
apiV1Router.use('/headless-browser', headlessBrowserRouter);
apiV1Router.use('/analytics', analyticsRouter);

// OwnId routes
apiV1Router.post('/setOwnIDDataByLoginId', async (req, res) => {
    const email = req.body.loginId; // The unique id of a user in your database, usually email or phone
    const { ownIdData } = req.body; // OwnID authentication information as string
    await userService.saveOwnIdData(email, ownIdData);
    return res.sendStatus(204);
});

apiV1Router.post('/getOwnIDDataByLoginId', async (req, res) => {
    const email = req.body.loginId; // The unique id of a user in your database, usually email or phone
    const ownIdData = await userService.getOwnIdData(email);
    if (!ownIdData) {
        return res.json({ errorCode: 404 });
    } // Error code when user doesn't exist
    return res.json({ ownIdData }); // OwnID authentication information as string
});

apiV1Router.post('/getSessionByLoginId', async (req, res) => {
    const email: string = req.body.loginId; // The unique id of a user in your database, usually email or phone
    const user = await userModel.findUserByEmail(email);
    const ownIdData = await userService.getOwnIdData(email);
    if (!user || !ownIdData) {
        return res.json({ errorCode: 404 });
    } // Error code when user doesn't exist
    return res.json({ email, ownIdData });
});

apiV1Router.post('/loginWithOwnIdData', async (req, res, next) => {
    const { email, ownIdData } = req.body;
    const user = await userService.getUserByEmailAndOwnIdData(email, ownIdData);
    req.login(user, (err) => {
        if (err) {
            next(err);
        }
        res.json({
            status: 'ok',
            results: user,
        });
    });
});
